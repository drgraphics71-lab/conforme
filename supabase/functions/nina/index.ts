// Fonction « nina » — l'après-refus.
//
// Deux actions :
//   diagnostiquer → lit les captures de la notification Meta, en tire le
//                   motif affiché, la cause réelle, la correction, et une
//                   version réécrite de la publicité.
//   revision      → rédige la demande de révision à envoyer à Meta.
//
// Le motif que Meta affiche est presque toujours générique. Tout l'intérêt
// est de remonter de ce motif à ce qui, dans la création, l'a déclenché.
//
// Variables d'environnement : ANTHROPIC_API_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MODELE = 'claude-sonnet-5';
const CLE_IA = Deno.env.get('ANTHROPIC_API_KEY');
const URL_SUPABASE = Deno.env.get('SUPABASE_URL')!;
const CLE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLE_ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const ENTETES = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const service = createClient(URL_SUPABASE, CLE_SERVICE, { auth: { persistSession: false } });

const TYPES_IMAGE: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

async function chargerImage(chemin: string): Promise<Record<string, unknown> | null> {
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

async function appelerClaude(systeme: string, contenu: unknown[], maxTokens: number, prefixe?: string): Promise<string> {
  const messages: Record<string, unknown>[] = [{ role: 'user', content: contenu }];
  if (prefixe) messages.push({ role: 'assistant', content: prefixe });

  const reponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CLE_IA!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODELE, max_tokens: maxTokens, system: systeme, messages }),
  });
  if (!reponse.ok) throw new Error(`Anthropic ${reponse.status} : ${(await reponse.text()).slice(0, 300)}`);

  const data = await reponse.json();
  const texte = (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('');
  return (prefixe ?? '') + texte;
}

function extraireJson<T>(brut: string): T {
  return JSON.parse(brut.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()) as T;
}

// ---------------------------------------------------- consigne : diagnostic

const SYSTEME_DIAGNOSTIC = `Tu travailles dans une agence qui gère des comptes publicitaires Meta. Une publicité vient d'être refusée, ou un compte vient d'être restreint. On te donne les captures de la notification, et quand elle est connue, la publicité concernée.

Ton travail se fait en deux temps.

D'abord tu lis la capture. Tu relèves le motif exact affiché par Meta, mot pour mot, la règle citée si elle est nommée, et ce qui est touché : une annonce, un compte publicitaire, une Page, un catalogue. Une restriction de compte est bien plus grave qu'un refus d'annonce et ne se traite pas pareil.

Ensuite, et c'est l'essentiel, tu remontes du motif affiché à la cause réelle. Meta affiche des motifs génériques : « Pratiques commerciales inacceptables » peut venir d'une promesse de gain, d'un compte à rebours mensonger ou d'une page de destination incohérente. Tu dis ce qui, concrètement, dans cette création précise, a déclenché ce refus. Si tu n'as pas la création sous les yeux, tu dis quelles sont les deux ou trois causes les plus probables pour ce motif, en commençant par la plus fréquente, et ce qu'il faut vérifier pour trancher.

Tu envisages sérieusement le faux positif. La revue automatique de Meta se trompe souvent, en particulier sur les comptes récents et sur les secteurs sensibles. Si rien dans la création ne justifie le refus, tu le dis : la demande de révision devient alors le bon chemin, et corriger une pub conforme serait une perte de temps.

Tu recommandes une stratégie, et une seule :
- corriger : la création est effectivement en faute, on la modifie et on resoumet.
- revision : la création est conforme, on conteste sans rien changer.
- les_deux : on conteste, mais on prépare une version corrigée en parallèle parce que l'issue est incertaine ou que la diffusion est urgente.
- abandonner : la création est irrécupérable, le produit ou l'angle est hors des règles.

Deux réflexes à ne jamais oublier : on ne resoumet jamais une création refusée à l'identique, ça aggrave l'historique du compte ; et une restriction de compte se traite avant toute chose, avant même de retoucher la moindre pub.

Quand tu proposes une version corrigée, tu réécris le texte en entier, prêt à coller, en gardant l'angle marketing d'origine. Tu ne rends pas la pub fade sous prétexte de la rendre conforme : c'est le travail, garder la force du message en retirant ce qui bloque. Si tu n'as pas le texte d'origine, tu laisses ce champ à null.

Tu réponds uniquement en JSON valide, sans texte autour :
{"motif_affiche": "le motif Meta, mot pour mot, ou null", "politique": "la règle citée, ou null", "niveau": "annonce|compte|page|catalogue|inconnu", "cause": "ce qui l'a déclenché, deux à quatre phrases", "correction": "ce qu'il faut faire, concrètement", "texte_corrige": "la pub réécrite, ou null", "strategie": "corriger|revision|les_deux|abandonner", "faux_positif": true|false}`;

// ----------------------------------------------------- consigne : révision

const SYSTEME_REVISION = `Tu rédiges une demande de révision à envoyer à Meta après le refus d'une publicité.

Ce texte est lu vite, souvent par un modérateur qui traite des centaines de cas, parfois par un système automatique. Il doit être court, factuel, et vérifiable.

Ce qui fonctionne : dire ce qu'annonce la publicité, pourquoi elle respecte la règle citée, et sur quoi ça se vérifie — la page de destination, une mention légale, une autorisation détenue, un agrément. Si une correction a été apportée, la nommer précisément.

Ce qui ne fonctionne jamais, et que tu ne fais donc pas : se plaindre, invoquer le budget dépensé ou l'ancienneté du compte, dire que d'autres annonceurs font pire, menacer de partir, écrire en majuscules, ou faire un pavé. Rien de tout cela ne pèse sur la décision.

Cinq à huit lignes, en anglais si le compte est géré en anglais, sinon en français — par défaut, français. Un paragraphe, pas de liste, pas de formule de politesse allongée. Ton neutre et professionnel, celui de quelqu'un qui expose des faits sans émotion.

Tu renvoies uniquement le texte de la demande, rien d'autre.`;

// -------------------------------------------------------------- actions

async function diagnostiquer(espaceId: string, refusId: string) {
  const { data: refus } = await service
    .from('pub_refus')
    .select('*, client:pub_clients(nom, verticale, notes)')
    .eq('id', refusId)
    .eq('espace_id', espaceId)
    .single();
  if (!refus) throw new Error('Refus introuvable');

  const contenu: unknown[] = [];
  for (const chemin of (refus.captures ?? []) as string[]) {
    const image = await chargerImage(chemin);
    if (image) contenu.push(image);
  }
  if (!contenu.length) throw new Error("Aucune capture exploitable. Déposez l'écran de la notification Meta.");

  // La publicité concernée, quand elle a déjà été vérifiée par Gaby.
  let annonce: Record<string, unknown> | null = null;
  if (refus.annonce_id) {
    const { data } = await service
      .from('pub_annonces')
      .select('reference, texte_principal, titre, description, cta, url_destination, transcription')
      .eq('id', refus.annonce_id)
      .maybeSingle();
    annonce = data;
  }

  // Ce qui a débloqué les refus précédents de ce client : le meilleur
  // indice disponible, bien meilleur que les règles générales.
  const { data: historique } = await service
    .from('pub_refus')
    .select('motif_affiche, cause, resolution')
    .eq('client_id', refus.client_id)
    .eq('statut', 'resolu')
    .not('resolution', 'is', null)
    .limit(8);

  const client = refus.client as { nom: string; verticale: string; notes: string | null } | null;

  contenu.push({
    type: 'text',
    text: [
      `Client : ${client?.nom ?? '—'} (${client?.verticale ?? 'autre'})`,
      client?.notes ? `Contexte : ${client.notes}` : null,
      `Référence : ${refus.reference}`,
      '',
      annonce
        ? `La publicité concernée :\nTexte principal : ${annonce.texte_principal || '(vide)'}\nTitre : ${annonce.titre ?? '(vide)'}\nDescription : ${annonce.description ?? '(vide)'}\nBouton : ${annonce.cta ?? '(aucun)'}\nPage de destination : ${annonce.url_destination ?? '(non fournie)'}${annonce.transcription ? `\nTranscription de la vidéo : ${annonce.transcription}` : ''}`
        : "La publicité concernée n'est pas rattachée : raisonne à partir de la seule notification.",
      historique?.length
        ? `\nCe qui a débloqué les refus précédents de ce client :\n${historique
            .map((h) => `- ${h.motif_affiche ?? 'motif inconnu'} → ${h.resolution}`)
            .join('\n')}`
        : '',
      '',
      'Diagnostique.',
    ]
      .filter((l) => l !== null)
      .join('\n'),
  });

  const brut = await appelerClaude(SYSTEME_DIAGNOSTIC, contenu, 2000, '{');
  const resultat = extraireJson<{
    motif_affiche: string | null;
    politique: string | null;
    niveau: string;
    cause: string;
    correction: string;
    texte_corrige: string | null;
    strategie: string;
    faux_positif: boolean;
  }>(brut);

  const niveaux = ['annonce', 'compte', 'page', 'catalogue', 'inconnu'];
  const strategies = ['corriger', 'revision', 'les_deux', 'abandonner'];

  await service
    .from('pub_refus')
    .update({
      motif_affiche: resultat.motif_affiche,
      politique: resultat.politique,
      niveau: niveaux.includes(resultat.niveau) ? resultat.niveau : 'inconnu',
      cause: resultat.cause,
      correction: resultat.correction,
      texte_corrige: resultat.texte_corrige,
      strategie: strategies.includes(resultat.strategie) ? resultat.strategie : 'corriger',
      faux_positif: Boolean(resultat.faux_positif),
      statut: refus.statut === 'nouveau' ? 'traite' : refus.statut,
      analyse_le: new Date().toISOString(),
    })
    .eq('id', refusId);

  return { ok: true };
}

async function revision(espaceId: string, refusId: string) {
  const { data: refus } = await service
    .from('pub_refus')
    .select('*, client:pub_clients(nom, verticale)')
    .eq('id', refusId)
    .eq('espace_id', espaceId)
    .single();
  if (!refus) throw new Error('Refus introuvable');

  const client = refus.client as { nom: string; verticale: string } | null;

  const demande = await appelerClaude(
    SYSTEME_REVISION,
    [
      {
        type: 'text',
        text: [
          `Annonceur : ${client?.nom ?? '—'} (${client?.verticale ?? 'autre'})`,
          `Référence : ${refus.reference}`,
          `Motif affiché par Meta : ${refus.motif_affiche ?? 'non précisé'}`,
          `Règle citée : ${refus.politique ?? 'non précisée'}`,
          `Ce qui est touché : ${refus.niveau}`,
          '',
          `Diagnostic : ${refus.cause ?? 'non établi'}`,
          refus.faux_positif
            ? 'La création est jugée conforme : la demande doit expliquer pourquoi, sans annoncer de correction.'
            : `Correction apportée : ${refus.correction ?? 'aucune'}`,
          refus.texte_corrige ? `\nVersion corrigée soumise :\n${refus.texte_corrige}` : '',
          '',
          'Rédige la demande de révision.',
        ].join('\n'),
      },
    ],
    1000,
  );

  await service.from('pub_refus').update({ demande_revision: demande.trim() }).eq('id', refusId);
  return { demande: demande.trim() };
}

// --------------------------------------------------------------- entrée

Deno.serve(async (requete) => {
  if (requete.method === 'OPTIONS') return new Response('ok', { headers: ENTETES });

  try {
    if (!CLE_IA) {
      return new Response(
        JSON.stringify({
          erreur:
            "Clé ANTHROPIC_API_KEY absente. Ajoutez-la dans Supabase, Edge Functions, onglet Secrets, puis relancez.",
        }),
        { status: 400, headers: ENTETES },
      );
    }

    const jeton = requete.headers.get('Authorization') ?? '';
    const corps = await requete.json();
    const { action, espace_id, refus_id } = corps;

    const appelant = createClient(URL_SUPABASE, CLE_ANON, {
      global: { headers: { Authorization: jeton } },
      auth: { persistSession: false },
    });
    const { data: membre } = await appelant
      .from('membres').select('espace_id').eq('espace_id', espace_id).maybeSingle();
    if (!membre) {
      return new Response(JSON.stringify({ erreur: 'Accès refusé' }), { status: 403, headers: ENTETES });
    }

    if (action === 'diagnostiquer') {
      return new Response(JSON.stringify(await diagnostiquer(espace_id, refus_id)), { headers: ENTETES });
    }
    if (action === 'revision') {
      return new Response(JSON.stringify(await revision(espace_id, refus_id)), { headers: ENTETES });
    }
    return new Response(JSON.stringify({ erreur: 'Action inconnue' }), { status: 400, headers: ENTETES });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ erreur: e instanceof Error ? e.message : 'Erreur inattendue' }),
      { status: 500, headers: ENTETES },
    );
  }
});
