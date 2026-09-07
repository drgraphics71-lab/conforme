import { useEffect, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Plus } from 'lucide-react';
import { useSession } from '@/lib/session';

/** Sélecteur d'espace. Un espace = une agence, avec ses clients, ses lots
 *  et ses règles. Affiché dans la barre du haut de chaque agent. */
export default function SelecteurEspace({ compact = false }: { compact?: boolean }) {
  const { espace, espaces, changerEspace, creerEspace } = useSession();
  const [ouvert, setOuvert] = useState(false);
  const [creation, setCreation] = useState(false);
  const [nom, setNom] = useState('');
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const boite = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) { setOuvert(false); setCreation(false); }
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  if (!espace) return null;

  async function creer() {
    if (!nom.trim() || travail) return;
    setTravail(true); setErreur(null);
    try {
      await creerEspace(nom.trim());
      setOuvert(false); setCreation(false); setNom('');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible');
    } finally {
      setTravail(false);
    }
  }

  return (
    <div ref={boite} className="relative">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="flex items-center gap-2 rounded-[10px] px-2.5 py-1.5 transition-colors hover:bg-[rgba(255,255,255,.06)]"
        title="Changer d'espace"
      >
        {!compact && <Building2 size={14} className="text-doux" />}
        <span className="text-[0.86rem] font-medium truncate max-w-[180px]">{espace.nom}</span>
        {espaces.length > 1 && <span className="puce text-doux">{espaces.length}</span>}
        <ChevronDown size={13} className="text-doux" />
      </button>

      {ouvert && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 w-[260px] rounded-[14px] p-1.5"
          style={{ background: '#0E1826', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 24px 48px -16px rgba(0,0,0,.85)' }}
        >
          <p className="etiq !mb-1 px-2 pt-1 uppercase tracking-[0.08em] text-[0.68rem]">Vos espaces</p>
          {espaces.map((e) => (
            <button
              key={e.id}
              onClick={() => { changerEspace(e.id); setOuvert(false); }}
              className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-[10px] hover:bg-[rgba(255,255,255,.06)]"
            >
              <span className="w-4">{e.id === espace.id && <Check size={13} className="text-cyan" />}</span>
              <span className="text-[0.85rem] truncate">{e.nom}</span>
            </button>
          ))}

          <div className="my-1 border-t border-trait" />

          {!creation ? (
            <button
              onClick={() => setCreation(true)}
              className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-[10px] hover:bg-[rgba(255,255,255,.06)] text-[0.85rem]"
            >
              <Plus size={14} className="text-cyan" /> Ajouter un espace
            </button>
          ) : (
            <div className="p-2">
              <input
                autoFocus
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void creer(); }}
                placeholder="Nom de l'espace"
                className="w-full rounded-[9px] px-2.5 py-2 text-[0.84rem] outline-none"
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)' }}
              />
              {erreur && <p className="text-[0.74rem] text-corail mt-1.5">{erreur}</p>}
              <button onClick={() => void creer()} disabled={!nom.trim() || travail} className="btn-primaire w-full mt-2 !py-1.5 !text-[0.8rem]">
                {travail ? 'Création…' : "Créer l'espace"}
              </button>
              <p className="aide !mt-1.5">
                Un espace séparé : ses clients, ses lots et ses règles maison.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
