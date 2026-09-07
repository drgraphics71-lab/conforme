import { supabase } from '@/lib/supabase';
import { messageErreur } from '@/lib/fonctions';
import type { Refus, StatutRefus } from './types';

export async function chargerRefus(espaceId: string, limite = 60): Promise<Refus[]> {
  const { data, error } = await supabase
    .from('pub_refus')
    .select('*, client:pub_clients(nom, verticale)')
    .eq('espace_id', espaceId)
    .order('cree_le', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as Refus[];
}

export async function creerRefus(
  espaceId: string,
  champs: { client_id: string; reference: string; annonce_id?: string | null },
): Promise<Refus> {
  const { data, error } = await supabase
    .from('pub_refus')
    .insert({ espace_id: espaceId, ...champs })
    .select('*, client:pub_clients(nom, verticale)')
    .single();
  if (error) throw error;
  return data as Refus;
}

export async function enregistrerRefus(id: string, maj: Partial<Refus>): Promise<void> {
  const { error } = await supabase.from('pub_refus').update(maj).eq('id', id);
  if (error) throw error;
}

export async function supprimerRefus(id: string): Promise<void> {
  const { error } = await supabase.from('pub_refus').delete().eq('id', id);
  if (error) throw error;
}

export async function changerStatut(id: string, statut: StatutRefus): Promise<void> {
  const maj: Partial<Refus> = { statut };
  if (statut === 'resolu') maj.resolu_le = new Date().toISOString();
  await enregistrerRefus(id, maj);
}

/** Ajoute une capture au refus et renvoie la liste complète des chemins. */
export async function ajouterCapture(
  espaceId: string,
  refus: Refus,
  fichier: File,
): Promise<string[]> {
  const extension = fichier.name.split('.').pop()?.toLowerCase() ?? 'png';
  const chemin = `${espaceId}/refus/${refus.id}/${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from('pubs').upload(chemin, fichier, { upsert: true, contentType: fichier.type });
  if (error) throw error;

  const captures = [...(refus.captures ?? []), chemin];
  await enregistrerRefus(refus.id, { captures });
  return captures;
}

export async function retirerCapture(refus: Refus, chemin: string): Promise<string[]> {
  const captures = (refus.captures ?? []).filter((c) => c !== chemin);
  await supabase.storage.from('pubs').remove([chemin]);
  await enregistrerRefus(refus.id, { captures });
  return captures;
}

export async function urlCapture(chemin: string): Promise<string | null> {
  const { data } = await supabase.storage.from('pubs').createSignedUrl(chemin, 3600);
  return data?.signedUrl ?? null;
}

/** Lecture de la capture puis diagnostic, en un seul appel. */
export async function analyserRefus(espaceId: string, refusId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('nina', {
    body: { action: 'diagnostiquer', espace_id: espaceId, refus_id: refusId },
  });
  if (error) throw new Error(await messageErreur(error));
  if (data?.erreur) throw new Error(data.erreur);
}

/** Rédige le brouillon de demande de révision à envoyer à Meta. */
export async function redigerRevision(espaceId: string, refusId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('nina', {
    body: { action: 'revision', espace_id: espaceId, refus_id: refusId },
  });
  if (error) throw new Error(await messageErreur(error));
  if (data?.erreur) throw new Error(data.erreur);
  return data.demande as string;
}

/** Transforme un refus en règle maison : c'est là que l'outil apprend.
 *  Un motif rencontré une fois chez un client se retrouvera chez les autres. */
export async function verserEnRegle(
  espaceId: string,
  refus: Refus,
  regle: { motif: string; gravite: 'bloquant' | 'risque' | 'avertissement'; pourquoi: string; correction: string },
): Promise<void> {
  const { error } = await supabase.from('pub_regles_maison').insert({
    espace_id: espaceId,
    client_id: null,
    motif: regle.motif,
    gravite: regle.gravite,
    politique: refus.politique ?? 'Refus constaté',
    pourquoi: regle.pourquoi,
    correction: regle.correction,
  });
  if (error) throw error;
}
