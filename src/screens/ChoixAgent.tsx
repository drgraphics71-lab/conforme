import { LogOut } from 'lucide-react';
import { useSession } from '@/lib/session';
import SelecteurEspace from '@/components/SelecteurEspace';
import { AGENTS, type CleAgent } from '@/lib/agents';
import { MARQUE } from '@/lib/marque';

export default function ChoixAgent({ onChoisir }: { onChoisir: (cle: CleAgent) => void }) {
  const { deconnecter } = useSession();

  return (
    <div className="dessus min-h-screen">
      <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-trait">
        <div className="flex items-center gap-3">
          <span
            className="w-[26px] h-[26px] rounded-[9px]"
            style={{ background: 'linear-gradient(150deg,#22D3EE,#818CF8)', boxShadow: '0 0 18px rgba(129,140,248,.55)' }}
          />
          <p className="text-[0.98rem] font-semibold tracking-tight">{MARQUE}</p>
        </div>
        <div className="flex items-center gap-2">
          <SelecteurEspace compact />
          <button onClick={() => void deconnecter()} className="btn-pas" title="Se déconnecter" aria-label="Se déconnecter">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="px-5 md:px-8 py-12 max-w-[900px] mx-auto">
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Avec qui travaillez-vous ?</h1>
        <p className="sous-section">Chaque agent a son poste. Vous pouvez changer à tout moment.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {AGENTS.map((agent) => (
            <button
              key={agent.cle}
              onClick={() => agent.disponible && onChoisir(agent.cle)}
              disabled={!agent.disponible}
              className={`verre p-6 text-left transition-colors ${
                agent.disponible ? 'hover:border-cyan' : 'opacity-45 cursor-default'
              }`}
            >
              <span
                className="block w-[38px] h-[38px] rounded-[13px]"
                style={{ background: `linear-gradient(150deg,${agent.teintes[0]},${agent.teintes[1]})` }}
              />
              <p className="mt-4 text-[1.05rem] font-semibold tracking-tight">{agent.nom}</p>
              <p className="text-[0.78rem] text-doux">{agent.role}</p>
              <p className="mt-3 text-[0.85rem] text-doux leading-relaxed">{agent.description}</p>
              {!agent.disponible && <p className="aide">Bientôt</p>}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
