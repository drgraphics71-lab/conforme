// Types de l'agent Gaby (conformité des publicités Meta).
// Alignés sur les tables pub_*.

export type Verticale = 'ecommerce' | 'formation' | 'crypto' | 'finance' | 'sante' | 'services' | 'autre';

export type Gravite = 'bloquant' | 'risque' | 'avertissement';

/** Verdict d'une annonce, du plus grave au plus sûr. */
export type Verdict = 'refus_probable' | 'a_corriger' | 'conforme';

export type StatutLot = 'brouillon' | 'analyse' | 'analyse_ok' | 'repondu';

export type SourcePoint = 'auto' | 'ia' | 'maison';

export type FormatAnnonce = 'image' | 'video' | 'carrousel' | 'texte';

export interface ClientPub {
  id: string;
  espace_id: string;
  nom: string;
  verticale: Verticale;
  compte_meta: string | null;
  contact_email: string | null;
  /** Notes libres : contraintes propres au client, historique de refus. */
  notes: string | null;
  /** Comment Gaby doit écrire au client. */
  vouvoiement: boolean;
  signature: string | null;
  cree_le: string;
}

export interface Lot {
  id: string;
  espace_id: string;
  client_id: string;
  titre: string;
  statut: StatutLot;
  message_client: string | null;
  message_envoye_le: string | null;
  cree_le: string;
  analyse_le: string | null;
  /** Rattachement résolu à la lecture. */
  client?: Pick<ClientPub, 'nom' | 'verticale' | 'vouvoiement' | 'contact_email'> | null;
  /** Compteurs calculés côté base (vue pub_lots_compte). */
  nb_annonces?: number;
  nb_bloquantes?: number;
}

export interface Annonce {
  id: string;
  espace_id: string;
  lot_id: string;
  /** Référence côté client : « Pub 3 », « BF-carrousel-2 »… */
  reference: string;
  texte_principal: string;
  titre: string | null;
  description: string | null;
  cta: string | null;
  url_destination: string | null;
  pays: string;
  format: FormatAnnonce;
  /** Chemin de la vignette dans le bucket « pubs ». */
  visuel_chemin: string | null;
  /** Piste audio extraite, pour la transcription. */
  audio_chemin: string | null;
  /** Ce qui est dit et affiché dans la vidéo. */
  transcription: string | null;
  duree_s: number | null;
  verdict: Verdict | null;
  risque: number | null;
  /** Ce que Gaby a compris du visuel, en une phrase. */
  lecture_visuel: string | null;
  analyse_le: string | null;
  cree_le: string;
}

export interface Point {
  id: string;
  espace_id: string;
  annonce_id: string;
  regle_id: string;
  source: SourcePoint;
  gravite: Gravite;
  /** Nom de la règle Meta concernée, tel qu'il apparaît dans les standards. */
  politique: string;
  /** Le morceau de la pub qui pose problème. */
  extrait: string | null;
  pourquoi: string;
  correction: string;
  /** David a jugé le point non pertinent : il ne compte plus. */
  ecarte: boolean;
  cree_le: string;
}

/** Règle ajoutée à la main, propre à l'entreprise ou à un client. */
export interface RegleMaison {
  id: string;
  espace_id: string;
  client_id: string | null;
  motif: string;
  gravite: Gravite;
  politique: string;
  pourquoi: string;
  correction: string;
  actif: boolean;
  cree_le: string;
}

/** Image clé extraite d'une vidéo. */
export interface Visuel {
  id: string;
  espace_id: string;
  annonce_id: string;
  chemin: string;
  timecode_s: number;
  cree_le: string;
}

/** Une annonce avec ses points et ses images, pour l'affichage. */
export interface AnnonceDetaillee extends Annonce {
  points: Point[];
  visuels: Visuel[];
}

export const LIBELLE_VERTICALE: Record<Verticale, string> = {
  ecommerce: 'E-commerce',
  formation: 'Formation',
  crypto: 'Crypto',
  finance: 'Services financiers',
  sante: 'Santé / bien-être',
  services: 'Services',
  autre: 'Autre',
};

export const LIBELLE_VERDICT: Record<Verdict, string> = {
  conforme: 'Diffusable',
  a_corriger: 'À corriger',
  refus_probable: 'Sera refusée',
};

export const LIBELLE_GRAVITE: Record<Gravite, string> = {
  bloquant: 'Bloquant',
  risque: 'Risqué',
  avertissement: 'À surveiller',
};

/** Couleurs du thème, par verdict. */
export const TEINTE_VERDICT: Record<Verdict, string> = {
  conforme: '#34D399',
  a_corriger: '#FBBF24',
  refus_probable: '#F87171',
};

export const TEINTE_GRAVITE: Record<Gravite, string> = {
  bloquant: '#F87171',
  risque: '#FBBF24',
  avertissement: '#8B93A5',
};
