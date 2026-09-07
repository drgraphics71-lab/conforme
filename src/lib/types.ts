// Socle du produit : un compte utilisateur, rattaché à un ou plusieurs
// espaces. Un espace = une agence ou un indépendant, avec ses clients,
// ses lots et ses règles. Tout le reste s'accroche là-dessus.

export interface Espace {
  id: string;
  nom: string;
  /** Ce que l'agence met au bas de ses messages clients. */
  signature: string | null;
  logo_chemin: string | null;
  fuseau: string;
  cree_le: string;
}

export type RoleMembre = 'proprietaire' | 'membre';

export interface Membre {
  id: string;
  espace_id: string;
  utilisateur_id: string;
  role: RoleMembre;
  cree_le: string;
}

export type Formule = 'essai' | 'solo' | 'agence';

export interface Abonnement {
  id: string;
  espace_id: string;
  formule: Formule;
  actif: boolean;
  /** Nombre de publicités vérifiables sur le mois en cours. */
  quota_mensuel: number;
  consomme: number;
  renouvelle_le: string | null;
}

export const LIBELLE_FORMULE: Record<Formule, string> = {
  essai: 'Essai',
  solo: 'Solo',
  agence: 'Agence',
};
