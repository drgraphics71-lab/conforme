// Fonction « gaby » — le cerveau de Gaby.
//
// Deux actions :
//   verifier → analyse chaque annonce d'un lot (texte + visuel) et écrit
//              les points de non-conformité en base.
//   message  → rédige la réponse à renvoyer au client.
//
// Les contrôles évidents (mots interdits, forme, liens) sont déjà faits
// côté application par src/agents/pub/regles.ts. Ici on ne demande au
// modèle que ce qu'il est seul à pouvoir faire : lire le visuel,
// comprendre l'intention, et repérer ce qu'aucune expression régulière
// n'attrape.
//
// Les vidéos sont découpées côté navigateur (src/agents/pub/video.ts) :
// arrivent ici des images clés horodatées et une piste audio en WAV, que
// l'on fait transcrire avant de tout passer au modèle.
//
// Variables d'environnement : ANTHROPIC_API_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, et TRANSCRIPTION_API_KEY
// (facultative : sans elle, seuls les sous-titres incrustés sont lus).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODELE = 'claude-sonnet-5';
const CLE_IA = Deno.env.get('ANTHROPIC_API_KEY');
const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const CLE_TRANSCRIPTION = Deno.env.get('TRANSCRIPTION_API_KEY');
const URL_TRANSCRIPTION = Deno.env.get('TRANSCRIPTION_URL')
  ?? 'https://api.openai.com/v1/audio/transcriptions';
const MODELE_TRANSCRIPTION = Deno.env.get('TRANSCRIPTION_MODELE') ?? 'whisper-1';
/** Au-delà, on éclaircit : le coût grimpe vite et l'apport diminue. */
const IMAGES_MAX = 14;

const ENTETES = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });

// ------------------------------------------------------------- modèle

interface PointIA {
  regle_id: string;
  gravite: 'bloquant' | 'risque' | 'avertissement';
  politique: string;
  extrait: string | null;
  pourquoi: string;
  correction: string;
}

async function appelerClaude(
  systeme: string,
  contenu: unknown[],
  maxTokens: number,
  prefixe?: string,
): Promise<string> {
  const messages: Record<string, unknown>[] = [{ role: 'user', content: contenu }];
  if (prefixe) messages.push({ role: 'assistant', content: prefixe });

  const reponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLE_IA,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODELE, max_tokens: maxTokens, system: systeme, messages }),
  });

  if (!reponse.ok) {
    throw new Error(`Anthropic ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);
  }
  const data = await reponse.json();
  const texte = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  return (prefixe ?? '') + texte;
}

function extraireJson<T>(brut: string): T {
  const nettoye = brut.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(nettoye) as T;
}

// -------------------------------------------------------------- visuel

const TYPES_IMAGE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

/** Télécharge le visuel et le prépare pour l'API. null si absent ou vidéo. */
async function chargerVisuel(chemin: string | null): Promise<Record<string, unknown> | null> {
  if (!chemin) return null;
  const extension = chemin.split('.').pop()?.toLowerCase() ?? '';
  const type = TYPES_IMAGE[extension];
  if (!type) return null;

  const { data, error } = await service.storage.from('pubs').download(chemin);
  if (error || !data) return null;
  const octets = new Uint8Array(await data.arrayBuffer());
  if (octets.length > 3_500_000) return null;

  let binaire = '';
  for (let i = 0; i < octets.length; i += 8192) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 8192));
  }
  return { type: 'image', source: { type: 'base64', media_type: type, data: btoa(binaire) } };
}

/** Images clés d'une vidéo, éclaircies si elles sont trop nombreuses.
 *  La fin est toujours conservée : c'est là qu'est la carte de fin. */
async function chargerImagesCles(annonceId: string): Promise<{ blocs: unknown[]; reperes: string[] }> {
  const { data } = await service
    .from('pub_visuels').select('chemin, timecode_s').eq('annonce_id', annonceId).order('timecode_s');

  let visuels = (data ?? []) as { chemin: string; timecode_s: number }[];
  if (!visuels.length) return { blocs: [], reperes: [] };

  if (visuels.length > IMAGES_MAX) {
    const fin = visuels.slice(-5);
    const debut = visuels.slice(0, -5);
    const facteur = Math.ceil(debut.length / Math.max(1, IMAGES_MAX - fin.length));
    visuels = [...debut.filter((_, i) => i % facteur === 0), ...fin].slice(0, IMAGES_MAX);
  }

  const blocs: unknown[] = [];
  const reperes: string[] = [];
  for (const visuel of visuels) {
    const image = await chargerVisuel(visuel.chemin);
    if (!image) continue;
    reperes.push(`${visuel.timecode_s} s`);
    blocs.push({ type: 'text', text: `Image à ${visuel.timecode_s} s :` });
    blocs.push(image);
  }
  return { blocs, reperes };
}

/** Transcrit la piste audio si une clé est configurée. Renvoie null sinon :
 *  l'analyse se rabat alors sur les sous-titres incrustés dans les images. */
async function transcrire(chemin: string): Promise<string | null> {
  if (!CLE_TRANSCRIPTION) return null;
  const { data, error } = await service.storage.from('pubs').download(chemin);
  if (error || !data) return null;

  const formulaire = new FormData();
  formulaire.append('file', data, 'audio.wav');
  formulaire.append('model', MODELE_TRANSCRIPTION);
  formulaire.append('language', 'fr');

  const reponse = await fetch(URL_TRANSCRIPTION, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLE_TRANSCRIPTION}` },
    body: formulaire,
  });
  if (!reponse.ok) {
    console.error('Transcription refusée :', reponse.status, (await reponse.text()).slice(0, 200));
    return null;
  }
  const resultat = await reponse.json();
  const texte = typeof resultat.text === 'string' ? resultat.text.trim() : null;
  return texte || null;
}

// ------------------------------------------------------- consigne : analyse

const SYSTEME_ANALYSE = `Tu vérifies des publicités Meta (Facebook, Instagram) avant leur mise en ligne, pour une agence qui valide les créations de ses clients.

Ton travail : dire ce qui se fera refuser, et pourquoi. Tu connais les Standards publicitaires Meta : attributs personnels, allégations de santé, produits et services financiers trompeurs, cryptomonnaies (autorisation requise), pratiques commerciales inacceptables, fonctionnalités trompeuses, contenu choquant, contrefaçon, catégories spéciales (emploi, logement, crédit), qualité de la page de destination, grammaire et ponctuation, usage des marques Meta.

Pour une vidéo, tu reçois des images clés horodatées et, quand elle est disponible, la transcription de la bande son. Le message d'une vidéo publicitaire est presque toujours dans les sous-titres incrustés et la voix, pas dans le texte de l'annonce : c'est là qu'il faut chercher. Regarde en particulier la carte de fin, les dernières secondes, où figurent l'offre, le prix et les captures de la page de destination. Quand tu relèves un point vu dans la vidéo, indique le moment (« à 9 s ») dans l'extrait.

Une passe automatique a déjà relevé les mots et formulations interdits ; ils te sont donnés. N'y reviens pas. Cherche ce qu'elle ne peut pas voir :
- ce que montre le visuel : avant/après, gros plan sur une partie du corps, faux bouton de lecture, fausse croix de fermeture, faux commentaire ou fausse notification, capture d'interface Meta, mise en scène choquante, texte incrusté qui promet un gain, personne identifiable sans lien avec l'offre ;
- ce que dit ou affiche la vidéo : interpellation directe sur la situation du spectateur, promesse de gain, chiffre de rendement, mention de gratuité contredite par la carte de fin, absence de mention de risque sur une offre d'investissement ;
- ce que le texte sous-entend sans le dire : promesse de résultat implicite, insinuation sur la situation du lecteur, garantie déguisée ;
- l'écart entre la promesse et la page de destination annoncée ;
- la cohérence entre le visuel et le texte.

Règles de sévérité :
- bloquant : la pub sera refusée, ou expose le compte à une restriction.
- risque : passera peut-être, mais dépend du reviewer, ou demande une autorisation / une catégorie spéciale.
- avertissement : diffusable, mais fragile ou perfectible.

Tu ne signales que ce que tu vois réellement. Pas de point ajouté pour faire nombre, pas de reformulation d'un point déjà relevé. Si l'annonce est propre, tu renvoies une liste vide.

Chaque correction doit être applicable telle quelle : la phrase de remplacement, le réglage à changer, le document à fournir. Pas de conseil général.

Tu réponds uniquement en JSON valide, sans texte autour, avec cette forme :
{"lecture_visuel": "ce que montre l'image en une phrase, ou null", "points": [{"regle_id": "IA-1", "gravite": "bloquant|risque|avertissement", "politique": "nom de la règle Meta", "extrait": "le morceau concerné, ou null si c'est le visuel", "pourquoi": "une ou deux phrases", "correction": "ce qu'il faut faire"}]}`;

// ------------------------------------------------------ consigne : message

function systemeMessage(vouvoiement: boolean, ton: string, longueur: string, signature: string | null): string {
  return `Tu écris, à la place du responsable de l'agence, le retour qu'il envoie à son client après avoir vérifié ses publicités.

C'est un mail de travail entre deux personnes qui se connaissent. Pas un rapport, pas une note de synthèse.

Comment tu écris :
- ${vouvoiement ? 'Vouvoiement.' : 'Tutoiement.'} Ton ${ton === 'direct' ? 'direct, sans fioriture' : 'cordial mais bref'}.
- ${longueur === 'court' ? 'Le plus court possible. Une ligne de contexte, puis ce qui bloque.' : "Chaque pub concernée a son paragraphe : ce qui bloque, pourquoi Meta le refuse, la correction exacte."}
- Tu nommes les pubs par leur référence, comme le client les a envoyées.
- Tu donnes la correction en clair, avec la phrase de remplacement quand il y en a une.
- Ce qui est bon, tu le dis en une ligne et tu passes à la suite.

Ce que tu ne fais jamais :
- Pas d'emoji, pas de titres en gras, pas de tableau, pas de « Points positifs / Points à améliorer ».
- Pas de formule d'ouverture creuse (« J'espère que tu vas bien », « Merci pour ton envoi »).
- Pas de conclusion de politesse allongée, pas de « N'hésite pas à revenir vers moi si besoin ».
- Pas de vocabulaire de rapport : « analyse », « conformité globale », « recommandations », « il est important de noter », « à noter que ».
- Pas de liste à puces sauf si plus de quatre pubs sont concernées.
- Tu ne dis jamais qu'un outil, un agent ou une IA a fait la vérification.

Une phrase par idée, des phrases courtes. Tu écris comme quelqu'un qui a relu les pubs une par une et qui répond entre deux rendez-vous.

Tu finis par une seule ligne : ce que le client doit faire maintenant.${signature ? `\nTu signes : ${signature}` : '\nPas de signature, elle sera ajoutée à la main.'}

Tu renvoies uniquement le texte du message, rien d'autre.`;
}

// ------------------------------------------------------------- actions

async function verifier(espaceId: string, lotId: string) {
  const { data: lot } = await service
    .from('pub_lots')
    .select('*, client:pub_clients(nom, verticale, notes)')
    .eq('id', lotId)
    .eq('espace_id', espaceId)
    .single();
  if (!lot) throw new Error('Lot introuvable');

  await service.from('pub_lots').update({ statut: 'analyse' }).eq('id', lotId);

  const { data: annonces } = await service
    .from('pub_annonces').select('*').eq('lot_id', lotId).order('cree_le');

  const { data: reglesMaison } = await service
    .from('pub_regles_maison')
    .select('motif, gravite, politique, pourquoi, correction')
    .eq('espace_id', espaceId)
    .eq('actif', true);

  const client = lot.client as { nom: string; verticale: string; notes: string | null } | null;
  let bloquantes = 0;

  for (const annonce of annonces ?? []) {
    const { data: dejaVus } = await service
      .from('pub_points').select('politique, extrait, pourquoi').eq('annonce_id', annonce.id).eq('source', 'auto');

    // Vidéo : transcription (une seule fois) puis images clés horodatées.
    let transcription: string | null = annonce.transcription ?? null;
    if (annonce.format === 'video' && !transcription && annonce.audio_chemin) {
      transcription = await transcrire(annonce.audio_chemin);
      if (transcription) {
        await service.from('pub_annonces').update({ transcription }).eq('id', annonce.id);
      }
    }

    const contenu: unknown[] = [];
    const { blocs, reperes } = await chargerImagesCles(annonce.id);
    if (blocs.length) {
      contenu.push(...blocs);
    } else {
      const visuel = await chargerVisuel(annonce.visuel_chemin);
      if (visuel) contenu.push(visuel);
    }
    const aDuVisuel = contenu.length > 0;

    contenu.push({
      type: 'text',
      text: [
        `Client : ${client?.nom ?? '—'} (${client?.verticale ?? 'autre'})`,
        client?.notes ? `Contexte client : ${client.notes}` : null,
        `Pays de diffusion : ${annonce.pays}`,
        `Référence : ${annonce.reference}`,
        `Format : ${annonce.format}${annonce.duree_s ? ` (${annonce.duree_s} s)` : ''}`,
        reperes.length ? `Images fournies aux positions : ${reperes.join(', ')}` : null,
        '',
        `Texte principal : ${annonce.texte_principal || '(vide)'}`,
        `Titre : ${annonce.titre ?? '(vide)'}`,
        `Description : ${annonce.description ?? '(vide)'}`,
        `Bouton : ${annonce.cta ?? '(aucun)'}`,
        `Page de destination : ${annonce.url_destination ?? '(non fournie)'}`,
        transcription
          ? `\nTranscription de la bande son :\n${transcription}`
          : annonce.format === 'video'
            ? "\nPas de transcription disponible : lis les sous-titres incrustés dans les images."
            : null,
        aDuVisuel ? '' : '\nAucun visuel fourni : ne juge que le texte.',
        '',
        'Déjà relevé par la passe automatique, ne le répète pas :',
        (dejaVus ?? []).length
          ? (dejaVus ?? []).map((p) => `- ${p.politique} : ${p.pourquoi}`).join('\n')
          : '- rien',
        reglesMaison?.length
          ? `\nRègles internes de l'agence à appliquer en plus :\n${reglesMaison
              .map((r) => `- ${r.motif} (${r.gravite}) : ${r.pourquoi}`)
              .join('\n')}`
          : '',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    });

    let resultat: { lecture_visuel: string | null; points: PointIA[] };
    try {
      const brut = await appelerClaude(SYSTEME_ANALYSE, contenu, 2000, '{');
      resultat = extraireJson(brut);
    } catch (e) {
      console.error(`Analyse impossible pour ${annonce.reference} :`, e);
      continue;
    }

    await service.from('pub_points').delete().eq('annonce_id', annonce.id).eq('source', 'ia');
    if (resultat.points?.length) {
      await service.from('pub_points').insert(
        resultat.points.map((p, i) => ({
          espace_id: espaceId,
          annonce_id: annonce.id,
          regle_id: p.regle_id || `IA-${i + 1}`,
          source: 'ia',
          gravite: p.gravite,
          politique: p.politique,
          extrait: p.extrait,
          pourquoi: p.pourquoi,
          correction: p.correction,
        })),
      );
    }

    // Verdict final : contrôles automatiques + IA, points écartés exclus.
    const { data: tous } = await service
      .from('pub_points').select('gravite').eq('annonce_id', annonce.id).eq('ecarte', false);
    const poids = { bloquant: 45, risque: 20, avertissement: 6 } as const;
    const liste = (tous ?? []) as { gravite: keyof typeof poids }[];
    const risque = Math.min(100, liste.reduce((s, p) => s + poids[p.gravite], 0));
    const verdict = liste.some((p) => p.gravite === 'bloquant')
      ? 'refus_probable'
      : liste.some((p) => p.gravite === 'risque')
        ? 'a_corriger'
        : 'conforme';
    if (verdict === 'refus_probable') bloquantes += 1;

    await service
      .from('pub_annonces')
      .update({
        verdict,
        risque,
        lecture_visuel: resultat.lecture_visuel ?? null,
        analyse_le: new Date().toISOString(),
      })
      .eq('id', annonce.id);
  }

  await service
    .from('pub_lots')
    .update({ statut: 'analyse_ok', analyse_le: new Date().toISOString() })
    .eq('id', lotId);

  return { analysees: (annonces ?? []).length, bloquantes };
}

async function rediger(
  espaceId: string,
  lotId: string,
  longueur: 'court' | 'detaille',
  ton: 'direct' | 'cordial',
) {
  const { data: lot } = await service
    .from('pub_lots')
    .select('*, client:pub_clients(nom, vouvoiement, signature)')
    .eq('id', lotId)
    .eq('espace_id', espaceId)
    .single();
  if (!lot) throw new Error('Lot introuvable');

  const { data: annonces } = await service
    .from('pub_annonces')
    .select('reference, verdict, texte_principal, titre, points:pub_points(gravite, politique, extrait, pourquoi, correction, ecarte)')
    .eq('lot_id', lotId)
    .order('cree_le');

  type Ligne = {
    reference: string;
    verdict: string | null;
    titre: string | null;
    points: { gravite: string; politique: string; extrait: string | null; pourquoi: string; correction: string; ecarte: boolean }[];
  };

  const recapitulatif = ((annonces ?? []) as Ligne[])
    .map((a) => {
      const retenus = (a.points ?? []).filter((p) => !p.ecarte);
      if (!retenus.length) return `${a.reference} — rien à signaler.`;
      return [
        `${a.reference} — ${a.verdict === 'refus_probable' ? 'sera refusée' : 'à corriger'}`,
        ...retenus.map(
          (p) =>
            `  · [${p.gravite}] ${p.politique}${p.extrait ? ` — « ${p.extrait} »` : ''}\n    ${p.pourquoi}\n    Correction : ${p.correction}`,
        ),
      ].join('\n');
    })
    .join('\n\n');

  const client = lot.client as { nom: string; vouvoiement: boolean; signature: string | null } | null;

  const message = await appelerClaude(
    systemeMessage(client?.vouvoiement ?? true, ton, longueur, client?.signature ?? null),
    [
      {
        type: 'text',
        text: `Client : ${client?.nom ?? '—'}\nLot : ${lot.titre}\n\nCe que la vérification a donné :\n\n${recapitulatif}\n\nÉcris le message.`,
      },
    ],
    2000,
  );

  await service.from('pub_lots').update({ message_client: message.trim() }).eq('id', lotId);
  return { message: message.trim() };
}

// --------------------------------------------------------------- entrée

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: ENTETES });

  try {
    if (!CLE_IA) {
      return new Response(
        JSON.stringify({
          erreur:
            "Clé ANTHROPIC_API_KEY absente. Ajoutez-la dans Supabase, Edge Functions, onglet Secrets, puis relancez la vérification.",
        }),
        { status: 400, headers: ENTETES },
      );
    }

    const jeton = requete.headers.get('Authorization') ?? '';
    const corps = await requete.json();
    const { action, espace_id, lot_id } = corps;

    // L'appelant doit être membre de l'espace.
    const appelant = createClient(URL_SUPABASE, CLE_ANON, {
      global: { headers: { Authorization: jeton } },
      auth: { persistSession: false },
    });
    const { data: membre } = await appelant
      .from('membres').select('espace_id').eq('espace_id', espace_id).maybeSingle();
    if (!membre) {
      return new Response(JSON.stringify({ erreur: 'Accès refusé' }), { status: 403, headers: ENTETES });
    }

    if (action === 'verifier') {
      return new Response(JSON.stringify(await verifier(espace_id, lot_id)), { headers: ENTETES });
    }
    if (action === 'message') {
      const resultat = await rediger(
        espace_id,
        lot_id,
        corps.longueur === 'court' ? 'court' : 'detaille',
        corps.ton === 'cordial' ? 'cordial' : 'direct',
      );
      return new Response(JSON.stringify(resultat), { headers: ENTETES });
    }

    return new Response(JSON.stringify({ erreur: 'Action inconnue' }), { status: 400, headers: ENTETES });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : 'Erreur inattendue';
    // On ne laisse pas un lot bloqué en « analyse » si ça casse en cours de route.
    return new Response(JSON.stringify({ erreur: message }), { status: 500, headers: ENTETES });
  }
});
