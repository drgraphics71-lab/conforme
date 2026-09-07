// Nina — l'après-refus.
//
// Gaby s'occupe de l'avant. Nina prend le relais quand Meta a déjà tranché :
// on lui donne la capture de la notification, elle dit ce qui a réellement
// déclenché le refus, comment corriger, et rédige la demande de révision.
//
// Le motif affiché par Meta est presque toujours générique. Tout le travail
// consiste à remonter du motif affiché à la cause réelle.

/** Ce que Meta a restreint : une annonce, un compte, une Page, un catalogue. */
export type NiveauRefus = 'annonce' | 'compte' | 'page' | 'catalogue' | 'inconnu';

export type StatutRefus = 'nouveau' | 'traite' | 'resolu' | 'perdu';

/** Deux chemins possibles après un refus, et ils s'excluent. */
export type Strategie = 'corriger' | 'revision' | 'les_deux' | 'abandonner';

export interface Refus {
  id: string;
  espace_id: string;
  client_id: string;
  /** Rattachement à une annonce déjà vérifiée par Gaby, quand elle existe. */
  annonce_id: string | null;
  reference: string;
  /** Captures de la notification, du mail, du gestionnaire de publicités. */
  captures: string[];
  statut: StatutRefus;

  // --- ce que Nina lit dans la capture ---
  motif_affiche: string | null;
  politique: string | null;
  niveau: NiveauRefus;

  // --- ce que Nina en déduit ---
  cause: string | null;
  correction: string | null;
  texte_corrige: string | null;
  strategie: Strategie | null;
  demande_revision: string | null;
  /** Vrai quand Nina estime que la pub était conforme : faux positif Meta. */
  faux_positif: boolean;

  // --- la boucle d'apprentissage ---
  /** Ce qui a réellement débloqué la situation, saisi par l'utilisateur. */
  resolution: string | null;
  resolu_le: string | null;

  cree_le: string;
  analyse_le: string | null;

  client?: { nom: string; verticale: string } | null;
}

export const LIBELLE_NIVEAU: Record<NiveauRefus, string> = {
  annonce: 'Annonce refusée',
  compte: 'Compte restreint',
  page: 'Page restreinte',
  catalogue: 'Catalogue refusé',
  inconnu: 'À déterminer',
};

export const LIBELLE_STATUT: Record<StatutRefus, string> = {
  nouveau: 'À traiter',
  traite: 'Traité',
  resolu: 'Débloqué',
  perdu: 'Abandonné',
};

export const LIBELLE_STRATEGIE: Record<Strategie, string> = {
  corriger: 'Corriger et resoumettre',
  revision: 'Demander une révision',
  les_deux: 'Demander une révision, corriger en parallèle',
  abandonner: 'Renoncer à cette création',
};

export const TEINTE_NIVEAU: Record<NiveauRefus, string> = {
  annonce: '#FBBF24',
  compte: '#F87171',
  page: '#F87171',
  catalogue: '#FBBF24',
  inconnu: '#8B93A5',
};

export const TEINTE_STATUT: Record<StatutRefus, string> = {
  nouveau: '#FBBF24',
  traite: '#22D3EE',
  resolu: '#34D399',
  perdu: '#8B93A5',
};
