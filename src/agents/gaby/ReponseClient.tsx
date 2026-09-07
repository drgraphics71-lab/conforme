import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, PenLine } from 'lucide-react';
import { enregistrerMessage, marquerRepondu, redigerMessage } from './api';
import type { Lot } from './types';

interface ReponseProps {
  lot: Lot;
  espaceId: string;
  pretARediger: boolean;
  onChangement: () => void;
}

export default function ReponseClient({ lot, espaceId, pretARediger, onChangement }: ReponseProps) {
  const [texte, setTexte] = useState(lot.message_client ?? '');
  const [longueur, setLongueur] = useState<'court' | 'detaille'>('detaille');
  const [ton, setTon] = useState<'direct' | 'cordial'>('direct');
  const [travail, setTravail] = useState(false);
  const [copie, setCopie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => { setTexte(lot.message_client ?? ''); }, [lot.id, lot.message_client]);

  async function rediger() {
    setTravail(true); setErreur(null);
    try {
      setTexte(await redigerMessage(espaceId, lot.id, { longueur, ton }));
      onChangement();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Rédaction impossible.');
    } finally {
      setTravail(false);
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(texte);
    setCopie(true);
    window.setTimeout(() => setCopie(false), 1800);
  }

  return (
    <div className="verre p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="titre-section">Réponse au client</h3>
          <p className="sous-section">Relisez, ajustez, envoyez depuis votre messagerie.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="segment">
            <button data-on={longueur === 'court'} onClick={() => setLongueur('court')}>Court</button>
            <button data-on={longueur === 'detaille'} onClick={() => setLongueur('detaille')}>Détaillé</button>
          </div>
          <div className="segment">
            <button data-on={ton === 'direct'} onClick={() => setTon('direct')}>Direct</button>
            <button data-on={ton === 'cordial'} onClick={() => setTon('cordial')}>Cordial</button>
          </div>
        </div>
      </div>

      {texte ? (
        <>
          <textarea
            className="zone mt-4 text-[0.87rem]"
            rows={Math.min(22, Math.max(8, texte.split('\n').length + 2))}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onBlur={() => void enregistrerMessage(lot.id, texte)}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="btn-primaire" onClick={() => void copier()}>
              {copie ? <><Check size={15} /> Copié</> : <><Copy size={15} /> Copier le message</>}
            </button>
            <button className="btn-secondaire" onClick={() => void rediger()} disabled={travail}>
              {travail ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
              Réécrire
            </button>
            {lot.statut !== 'repondu' && (
              <button
                className="btn-secondaire"
                onClick={() => { void enregistrerMessage(lot.id, texte).then(() => marquerRepondu(lot.id)).then(onChangement); }}
              >
                <Check size={14} /> Marquer comme envoyé
              </button>
            )}
            {lot.message_envoye_le && (
              <span className="text-[0.78rem] text-menthe">Envoyé</span>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4">
          <button className="btn-primaire" onClick={() => void rediger()} disabled={travail || !pretARediger}>
            {travail ? <Loader2 size={15} className="animate-spin" /> : <PenLine size={15} />}
            {travail ? 'Rédaction…' : 'Rédiger la réponse'}
          </button>
          {!pretARediger && <p className="aide">Lancez d'abord la vérification du lot.</p>}
        </div>
      )}

      {erreur && <p className="mt-3 text-[0.82rem] text-corail">{erreur}</p>}
    </div>
  );
}
