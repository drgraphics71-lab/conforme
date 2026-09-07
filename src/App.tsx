import { useState } from 'react';
import { FournisseurSession, useSession } from '@/lib/session';
import Connexion from '@/screens/Connexion';
import PremierEspace from '@/screens/PremierEspace';
import ChoixAgent from '@/screens/ChoixAgent';
import AgentGaby from '@/agents/gaby/AgentGaby';
import AgentNina from '@/agents/nina/AgentNina';
import { agentMemorise, memoriserAgent, type CleAgent } from '@/lib/agents';

function Application() {
  const { session, espace, chargement, sansEspace } = useSession();
  const [agent, setAgent] = useState<CleAgent | null>(() => agentMemorise());

  function choisirAgent(cle: CleAgent | null) {
    memoriserAgent(cle);
    setAgent(cle);
  }

  if (chargement) {
    return (
      <div className="dessus min-h-screen grid place-items-center">
        <p className="text-[0.9rem] text-doux">Chargement…</p>
      </div>
    );
  }

  if (!session) return <Connexion />;
  if (sansEspace || !espace) return <PremierEspace />;
  if (!agent) return <ChoixAgent onChoisir={choisirAgent} />;

  if (agent === 'gaby') return <AgentGaby onChangerAgent={() => choisirAgent(null)} />;
  return <AgentNina onChangerAgent={() => choisirAgent(null)} />;
}

export default function App() {
  return (
    <FournisseurSession>
      <Application />
    </FournisseurSession>
  );
}
