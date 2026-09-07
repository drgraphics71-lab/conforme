import { useState } from 'react';
import { useSession } from '@/lib/session';

/** Premier lancement : le compte existe mais n'est rattaché à rien. */
export default function PremierEspace() {
  const { creerEspace, rafraichir, deconnecter } = useSession();
  const [nom, setNom] = useState('');
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    if (!nom.trim()) { setErreur("Il manque le nom de l'espace."); return; }
    setTravail(true); setErreur(null);
    try {
      await creerEspace(nom.trim());
      await rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible.');
      setTravail(false);
    }
  }

  return (
    <div className="dessus min-h-screen grid place-items-center px-6">
      <div className="verre p-8 max-w-sm w-full">
        <h1 className="text-[1.2rem] font-semibold tracking-tight">Créer votre espace</h1>
        <p className="mt-2 text-[0.86rem] text-doux leading-relaxed">
          Un espace regroupe vos clients, vos lots de publicités et vos règles.
          Vous pourrez en créer d'autres plus tard.
        </p>

        <label className="etiq mt-5" htmlFor="espace-nom">Nom de l'espace</label>
        <input
          id="espace-nom" className="champ" value={nom} autoFocus
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }}
          placeholder="Mon agence"
        />

        {erreur && <p className="mt-3 text-[0.82rem] text-corail">{erreur}</p>}

        <button className="btn-primaire mt-5 w-full" onClick={() => void valider()} disabled={travail}>
          {travail ? 'Création…' : "Créer l'espace"}
        </button>
        <button
          onClick={() => void deconnecter()}
          className="mt-3 w-full text-[0.78rem] text-pale hover:text-encre transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
