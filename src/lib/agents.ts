export type CleAgent = 'gaby' | 'nina';

export interface Agent {
  cle: CleAgent;
  nom: string;
  role: string;
  description: string;
  /** Un agent annoncé mais pas encore livré reste affiché, grisé. */
  disponible: boolean;
  /** Dégradé de la pastille, en attendant de vrais avatars. */
  teintes: [string, string];
}

export const AGENTS: Agent[] = [
  {
    cle: 'gaby',
    nom: 'Gaby',
    role: 'Conformité publicitaire',
    description:
      "Vérifie les pubs avant diffusion, dit ce qui sera refusé et pourquoi, et rédige le retour à envoyer au client.",
    disponible: true,
    teintes: ['#22D3EE', '#818CF8'],
  },
  {
    cle: 'nina',
    nom: 'Nina',
    role: 'Après-refus',
    description:
      "Lit la notification de refus, dit ce qui l'a réellement déclenché, réécrit la pub et rédige la demande de révision.",
    disponible: true,
    teintes: ['#F472B6', '#A78BFA'],
  },
];

const CLE = 'gaby.agent';

export function agentMemorise(): CleAgent | null {
  const v = localStorage.getItem(CLE);
  return v === 'gaby' || v === 'nina' ? v : null;
}

export function memoriserAgent(cle: CleAgent | null): void {
  if (cle) localStorage.setItem(CLE, cle);
  else localStorage.removeItem(CLE);
}
