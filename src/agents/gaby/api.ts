import { supabase } from '@/lib/supabase';
import { messageErreur } from '@/lib/fonctions';
import { calculerRisque, controler, deduireVerdict, type Constat } from './regles';
import { estUneVideo, extraireAudio, extraireImages, lireNomFichier } from './video';
import type {
  Annonce, AnnonceDetaillee, ClientPub, Gravite, Lot, Point, RegleMaison, Verticale,
} from './types';

// ---------------------------------------------------------------- clients

export async function chargerClients(espaceId: string): Promise<ClientPub[]> {
  const { data, error } = await supabase
    .from('pub_clients').select('*').eq('espace_id', espaceId).order('nom');
  if (error) throw error;
  return (data ?? []) as ClientPub[];
}

export async function creerClient(
  espaceId: string,
  champs: { nom: string; verticale: Verticale; compte_meta?: string | null; contact_email?: string | null },
): Promise<ClientPub> {
  const { data, error } = await supabase
    .from('pub_clients').insert({ espace_id: espaceId, ...champs }).select().single();
  if (error) throw error;
  return data as ClientPub;
}

export async function enregistrerClient(id: string, maj: Partial<ClientPub>): Promise<void> {
  const { error } = await supabase.from('pub_clients').update(maj).eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------------- lots

export async function chargerLots(espaceId: string, limite = 40): Promise<Lot[]> {
  const { data, error } = await supabase
    .from('pub_lots')
    .select('*, client:pub_clients(nom, verticale, vouvoiement, contact_email), annonces:pub_annonces(verdict)')
    .eq('espace_id', espaceId)
    .order('cree_le', { ascending: false })
    .limit(limite);
  if (error) throw error;

  type Brut = Lot & { annonces?: { verdict: Annonce['verdict'] }[] };
  return ((data ?? []) as Brut[]).map((l) => ({
    ...l,
    nb_annonces: l.annonces?.length ?? 0,
    nb_bloquantes: l.annonces?.filter((a) => a.verdict === 'refus_probable').length ?? 0,
  }));
}

export async function creerLot(espaceId: string, clientId: string, titre: string): Promise<Lot> {
  const { data, error } = await supabase
    .from('pub_lots')
    .insert({ espace_id: espaceId, client_id: clientId, titre })
    .select('*, client:pub_clients(nom, verticale, vouvoiement, contact_email)')
    .single();
  if (error) throw error;
  return data as Lot;
}

export async function supprimerLot(id: string): Promise<void> {
  const { error } = await supabase.from('pub_lots').delete().eq('id', id);
  if (error) throw error;
}

export async function enregistrerMessage(lotId: string, texte: string): Promise<void> {
  const { error } = await supabase.from('pub_lots').update({ message_client: texte }).eq('id', lotId);
  if (error) throw error;
}

export async function marquerRepondu(lotId: string): Promise<void> {
  const { error } = await supabase
    .from('pub_lots')
    .update({ statut: 'repondu', message_envoye_le: new Date().toISOString() })
    .eq('id', lotId);
  if (error) throw error;
}

// --------------------------------------------------------------- annonces

export async function chargerAnnonces(lotId: string): Promise<AnnonceDetaillee[]> {
  const { data, error } = await supabase
    .from('pub_annonces')
    .select('*, points:pub_points(*), visuels:pub_visuels(*)')
    .eq('lot_id', lotId)
    .order('cree_le', { ascending: true });
  if (error) throw error;
  const ordre = { bloquant: 0, risque: 1, avertissement: 2 } as const;
  return ((data ?? []) as AnnonceDetaillee[]).map((a) => ({
    ...a,
    points: [...(a.points ?? [])].sort((x, y) => ordre[x.gravite] - ordre[y.gravite]),
    visuels: [...(a.visuels ?? [])].sort((x, y) => x.timecode_s - y.timecode_s),
  }));
}

export interface BrouillonAnnonce {
  reference: string;
  texte_principal: string;
  titre?: string | null;
  description?: string | null;
  cta?: string | null;
  url_destination?: string | null;
  pays?: string;
  format?: Annonce['format'];
}

/** Ajoute des annonces et lance tout de suite les contrôles automatiques
 *  (ceux qui ne coûtent rien). L'analyse IA vient après, à la demande. */
export async function ajouterAnnonces(
  espaceId: string,
  lotId: string,
  brouillons: BrouillonAnnonce[],
  verticale: Verticale,
): Promise<AnnonceDetaillee[]> {
  const lignes = brouillons.map((b) => ({
    espace_id: espaceId,
    lot_id: lotId,
    reference: b.reference,
    texte_principal: b.texte_principal,
    titre: b.titre ?? null,
    description: b.description ?? null,
    cta: b.cta ?? null,
    url_destination: b.url_destination ?? null,
    pays: b.pays ?? 'FR',
    format: b.format ?? 'image',
  }));

  const { data, error } = await supabase.from('pub_annonces').insert(lignes).select();
  if (error) throw error;
  const creees = (data ?? []) as Annonce[];

  await Promise.all(creees.map((a) => passerControlesAuto(espaceId, a, verticale)));
  return chargerAnnonces(lotId);
}

/** Rejoue les contrôles automatiques sur une annonce (après modification). */
export async function passerControlesAuto(
  espaceId: string,
  annonce: Annonce,
  verticale: Verticale,
): Promise<Constat[]> {
  const constats = controler(
    {
      texte_principal: annonce.texte_principal,
      titre: annonce.titre,
      description: annonce.description,
      cta: annonce.cta,
      url_destination: annonce.url_destination,
      transcription: annonce.transcription,
    },
    verticale,
  );

  await supabase.from('pub_points').delete().eq('annonce_id', annonce.id).eq('source', 'auto');

  if (constats.length) {
    const { error } = await supabase.from('pub_points').insert(
      constats.map((c) => ({
        espace_id: espaceId,
        annonce_id: annonce.id,
        regle_id: c.regle_id,
        source: 'auto',
        gravite: c.gravite,
        politique: c.politique,
        extrait: c.extrait,
        pourquoi: c.pourquoi,
        correction: c.correction,
      })),
    );
    if (error) throw error;
  }

  await recalculerDepuisLaBase(annonce.id);
  return constats;
}

/** Relit tous les points retenus d'une annonce et en déduit verdict et risque.
 *  Utilisé après chaque écriture, pour que les contrôles automatiques ne
 *  effacent pas ce que l'analyse du visuel a trouvé, et inversement. */
export async function recalculerDepuisLaBase(annonceId: string): Promise<void> {
  const { data } = await supabase
    .from('pub_points').select('gravite').eq('annonce_id', annonceId).eq('ecarte', false);
  const retenus = (data ?? []) as { gravite: Gravite }[];
  await supabase
    .from('pub_annonces')
    .update({ verdict: deduireVerdict(retenus), risque: calculerRisque(retenus) })
    .eq('id', annonceId);
}

export async function enregistrerAnnonce(id: string, maj: Partial<Annonce>): Promise<void> {
  const { error } = await supabase.from('pub_annonces').update(maj).eq('id', id);
  if (error) throw error;
}

export async function supprimerAnnonce(id: string): Promise<void> {
  const { error } = await supabase.from('pub_annonces').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------- points

export async function ecarterPoint(id: string, ecarte: boolean): Promise<void> {
  const { error } = await supabase.from('pub_points').update({ ecarte }).eq('id', id);
  if (error) throw error;
}

/** Recalcule verdict et risque d'une annonce en ignorant les points écartés. */
export async function recalculerAnnonce(annonceId: string, points: Point[]): Promise<void> {
  const retenus = points.filter((p) => !p.ecarte);
  const { error } = await supabase
    .from('pub_annonces')
    .update({ verdict: deduireVerdict(retenus), risque: calculerRisque(retenus) })
    .eq('id', annonceId);
  if (error) throw error;
}

// --------------------------------------------------------------- visuels

export async function televerserVisuel(
  espaceId: string,
  annonceId: string,
  fichier: File,
): Promise<string> {
  const extension = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const chemin = `${espaceId}/${annonceId}/visuel.${extension}`;
  const { error } = await supabase.storage
    .from('pubs')
    .upload(chemin, fichier, { upsert: true, contentType: fichier.type });
  if (error) throw error;
  await enregistrerAnnonce(annonceId, { visuel_chemin: chemin, format: 'image' });
  return chemin;
}

export interface AvancementVideo {
  etape: 'images' | 'audio' | 'envoi';
  fait: number;
  total: number;
}

/** Découpe une vidéo dans le navigateur, envoie les images clés et la piste
 *  audio, puis rejoue les contrôles automatiques. La transcription se fait
 *  ensuite, côté serveur, au moment de l'analyse du lot. */
export async function televerserVideo(
  espaceId: string,
  annonceId: string,
  fichier: File,
  surAvancement?: (a: AvancementVideo) => void,
): Promise<void> {
  const { images, duree } = await extraireImages(fichier, {}, (fait, total) =>
    surAvancement?.({ etape: 'images', fait, total }));

  surAvancement?.({ etape: 'audio', fait: 0, total: 1 });
  let audioChemin: string | null = null;
  try {
    const audio = await extraireAudio(fichier);
    audioChemin = `${espaceId}/${annonceId}/audio.wav`;
    const { error } = await supabase.storage
      .from('pubs').upload(audioChemin, audio, { upsert: true, contentType: 'audio/wav' });
    if (error) throw error;
  } catch (e) {
    // Pas d'audio exploitable : on continue avec les seules images, où les
    // sous-titres incrustés restent lisibles.
    console.warn('Piste audio non extraite :', e);
    audioChemin = null;
  }

  await supabase.from('pub_visuels').delete().eq('annonce_id', annonceId);

  const lignes: { espace_id: string; annonce_id: string; chemin: string; timecode_s: number }[] = [];
  for (const [index, image] of images.entries()) {
    const chemin = `${espaceId}/${annonceId}/img-${String(index).padStart(4, '0')}.jpg`;
    const { error } = await supabase.storage
      .from('pubs').upload(chemin, image.blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    lignes.push({ espace_id: espaceId, annonce_id: annonceId, chemin, timecode_s: image.timecode });
    surAvancement?.({ etape: 'envoi', fait: index + 1, total: images.length });
  }

  if (lignes.length) {
    const { error } = await supabase.from('pub_visuels').insert(lignes);
    if (error) throw error;
  }

  await enregistrerAnnonce(annonceId, {
    format: 'video',
    duree_s: Math.round(duree * 10) / 10,
    audio_chemin: audioChemin,
    // La vignette est l'image d'ouverture.
    visuel_chemin: lignes[0]?.chemin ?? null,
  });
}

/** Aiguille selon le type de fichier déposé. */
export async function televerserMedia(
  espaceId: string,
  annonceId: string,
  fichier: File,
  surAvancement?: (a: AvancementVideo) => void,
): Promise<void> {
  if (estUneVideo(fichier)) {
    await televerserVideo(espaceId, annonceId, fichier, surAvancement);
  } else {
    await televerserVisuel(espaceId, annonceId, fichier);
  }
}

/** URL signée d'un fichier du bucket privé. Valable une heure. */
export async function urlVisuelPub(chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from('pubs').createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

/** Crée un lot d'annonces à partir de fichiers vidéo déposés en vrac.
 *  Les fichiers qui partagent le même identifiant de concept
 *  (2057_1, 2057_2…) deviennent des annonces distinctes du même lot. */
export async function ajouterVideos(
  espaceId: string,
  lotId: string,
  fichiers: File[],
  verticale: Verticale,
  surAvancement?: (nom: string, a: AvancementVideo) => void,
): Promise<AnnonceDetaillee[]> {
  for (const fichier of fichiers) {
    const { reference } = lireNomFichier(fichier.name);
    const { data, error } = await supabase
      .from('pub_annonces')
      .insert({
        espace_id: espaceId,
        lot_id: lotId,
        reference,
        texte_principal: '',
        format: 'video',
      })
      .select()
      .single();
    if (error) throw error;

    const annonce = data as Annonce;
    await televerserVideo(espaceId, annonce.id, fichier, (a) => surAvancement?.(fichier.name, a));
    await passerControlesAuto(espaceId, annonce, verticale);
  }
  return chargerAnnonces(lotId);
}

// ---------------------------------------------------------- règles maison

export async function chargerReglesMaison(espaceId: string): Promise<RegleMaison[]> {
  const { data, error } = await supabase
    .from('pub_regles_maison').select('*').eq('espace_id', espaceId).order('cree_le', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegleMaison[];
}

export async function creerRegleMaison(
  espaceId: string,
  regle: Omit<RegleMaison, 'id' | 'espace_id' | 'cree_le'>,
): Promise<RegleMaison> {
  const { data, error } = await supabase
    .from('pub_regles_maison').insert({ espace_id: espaceId, ...regle }).select().single();
  if (error) throw error;
  return data as RegleMaison;
}

export async function supprimerRegleMaison(id: string): Promise<void> {
  const { error } = await supabase.from('pub_regles_maison').delete().eq('id', id);
  if (error) throw error;
}

// ------------------------------------------------------------ analyse IA

/** Analyse fine du lot : visuels, sens du message, cohérence avec la page.
 *  La fonction « agent-pub » écrit les points en base et renvoie un résumé. */
export async function analyserLot(
  espaceId: string,
  lotId: string,
): Promise<{ analysees: number; bloquantes: number }> {
  const { data, error } = await supabase.functions.invoke('gaby', {
    body: { action: 'verifier', espace_id: espaceId, lot_id: lotId },
  });
  if (error) throw new Error(await messageErreur(error));
  if (data?.erreur) throw new Error(data.erreur);
  return data as { analysees: number; bloquantes: number };
}

/** Rédige la réponse à envoyer au client, à partir des points retenus. */
export async function redigerMessage(
  espaceId: string,
  lotId: string,
  options: { longueur: 'court' | 'detaille'; ton: 'direct' | 'cordial' },
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('gaby', {
    body: { action: 'message', espace_id: espaceId, lot_id: lotId, ...options },
  });
  if (error) throw new Error(await messageErreur(error));
  if (data?.erreur) throw new Error(data.erreur);
  return data.message as string;
}
