import { useState } from 'react';
import { ClipboardPaste, Plus, X } from 'lucide-react';
import type { BrouillonAnnonce } from './api';
import { analyserColle } from './collage';

interface DepotProps {
  onAjouter: (annonces: BrouillonAnnonce[]) => Promise<void>;
  onFermer: () => void;
}

export default function DepotAnnonces({ onAjouter, onFermer }: DepotProps) {
  const [mode, setMode] = useState<'une' | 'lot'>('une');
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [texte, setTexte] = useState('');
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [cta, setCta] = useState('');
  const [url, setUrl] = useState('');

  const [colle, setColle] = useState('');
  const apercu = mode === 'lot' && colle.trim() ? analyserColle(colle) : [];

  async function envoyer() {
    setErreur(null);
    const liste: BrouillonAnnonce[] =
      mode === 'une'
        ? [{
            reference: reference.trim() || 'Pub 1',
            texte_principal: texte.trim(),
            titre: titre.trim() || null,
            description: description.trim() || null,
            cta: cta.trim() || null,
            url_destination: url.trim() || null,
          }]
        : apercu;

    if (!liste.length || liste.every((a) => !a.texte_principal.trim())) {
      setErreur('Il faut au moins le texte de la publicité.');
      return;
    }
    setTravail(true);
    try {
      await onAjouter(liste);
      setReference(''); setTexte(''); setTitre(''); setDescription(''); setCta(''); setUrl(''); setColle('');
      onFermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Ajout impossible.");
    } finally {
      setTravail(false);
    }
  }

  return (
    <div className="verre p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="titre-section">Ajouter des publicités</h3>
          <p className="sous-section">
            Les contrôles automatiques partent dès l'ajout. L'analyse du visuel se lance ensuite, pour tout le lot.
          </p>
        </div>
        <button onClick={onFermer} className="btn-pas" aria-label="Fermer"><X size={14} /></button>
      </div>

      <div className="segment mt-4">
        <button data-on={mode === 'une'} onClick={() => setMode('une')}>Une par une</button>
        <button data-on={mode === 'lot'} onClick={() => setMode('lot')}>Coller un envoi client</button>
      </div>

      {mode === 'une' ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiq" htmlFor="pub-ref">Référence</label>
            <input id="pub-ref" className="champ" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Pub 1, BF-carrousel-2…" />
          </div>
          <div className="sm:col-span-2">
            <label className="etiq" htmlFor="pub-texte">Texte principal</label>
            <textarea id="pub-texte" className="zone" rows={5} value={texte} onChange={(e) => setTexte(e.target.value)}
              placeholder="Le texte au-dessus du visuel." />
          </div>
          <div>
            <label className="etiq" htmlFor="pub-titre">Titre</label>
            <input id="pub-titre" className="champ" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </div>
          <div>
            <label className="etiq" htmlFor="pub-desc">Description</label>
            <input id="pub-desc" className="champ" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="etiq" htmlFor="pub-cta">Bouton</label>
            <input id="pub-cta" className="champ" value={cta} onChange={(e) => setCta(e.target.value)}
              placeholder="En savoir plus" />
          </div>
          <div>
            <label className="etiq" htmlFor="pub-url">Page de destination</label>
            <input id="pub-url" className="champ" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://" />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <label className="etiq" htmlFor="pub-colle">Collez le message du client</label>
          <textarea id="pub-colle" className="zone font-mono text-[0.8rem]" rows={10} value={colle}
            onChange={(e) => setColle(e.target.value)}
            placeholder={'Pub 1\nTexte : ...\nTitre : ...\nLien : https://...\n---\nPub 2\nTexte : ...'} />
          <p className="aide">
            Séparez les pubs par une ligne de tirets. Les étiquettes « Texte », « Titre », « Description »,
            « Bouton » et « Lien » sont reconnues ; le reste part dans le texte principal.
          </p>
          {apercu.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {apercu.map((a, i) => (
                <span key={i} className="jeton">
                  <ClipboardPaste size={12} /> {a.reference}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {erreur && <p className="mt-3 text-[0.82rem] text-corail">{erreur}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primaire" onClick={() => void envoyer()} disabled={travail}>
          <Plus size={15} />
          {travail ? 'Ajout…' : mode === 'lot' && apercu.length > 1 ? `Ajouter ${apercu.length} pubs` : 'Ajouter'}
        </button>
        <button className="btn-secondaire" onClick={onFermer} disabled={travail}>Annuler</button>
      </div>
    </div>
  );
}
