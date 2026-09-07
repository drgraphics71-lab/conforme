import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Film, Image as ImageIcon, Loader2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import {
  ecarterPoint, recalculerAnnonce, supprimerAnnonce, televerserMedia, urlVisuelPub,
  type AvancementVideo,
} from './api';
import {
  LIBELLE_GRAVITE, LIBELLE_VERDICT, TEINTE_GRAVITE, TEINTE_VERDICT,
  type AnnonceDetaillee, type Point,
} from './types';

interface FicheProps {
  annonce: AnnonceDetaillee;
  espaceId: string;
  onChangement: () => void;
}

export default function FicheAnnonce({ annonce, espaceId, onChangement }: FicheProps) {
  const [ouvert, setOuvert] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);
  const [bande, setBande] = useState<{ url: string; timecode: number }[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [avancement, setAvancement] = useState<AvancementVideo | null>(null);
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivant = true;
    if (annonce.visuel_chemin) {
      void urlVisuelPub(annonce.visuel_chemin).then((u) => { if (vivant) setApercu(u); });
    } else {
      setApercu(null);
    }
    return () => { vivant = false; };
  }, [annonce.visuel_chemin]);

  // La bande d'images ne se charge qu'à l'ouverture de la fiche : une vidéo
  // en produit une trentaine, autant ne pas signer trente URL pour rien.
  useEffect(() => {
    let vivant = true;
    if (!ouvert || !annonce.visuels?.length) { setBande([]); return; }
    void Promise.all(
      annonce.visuels.map(async (v) => ({ url: await urlVisuelPub(v.chemin), timecode: v.timecode_s })),
    ).then((liste) => {
      if (vivant) {
        setBande(liste.filter((l): l is { url: string; timecode: number } => l.url !== null));
      }
    });
    return () => { vivant = false; };
  }, [ouvert, annonce.visuels]);

  const retenus = annonce.points.filter((p) => !p.ecarte);
  const verdict = annonce.verdict ?? 'conforme';
  const teinte = TEINTE_VERDICT[verdict];

  async function joindreMedia(f: File) {
    setEnvoi(true);
    try {
      await televerserMedia(espaceId, annonce.id, f, setAvancement);
      onChangement();
    } finally {
      setEnvoi(false);
      setAvancement(null);
    }
  }

  const libelleAvancement = avancement
    ? avancement.etape === 'images'
      ? `Images ${avancement.fait}/${avancement.total}`
      : avancement.etape === 'audio'
        ? 'Extraction du son'
        : `Envoi ${avancement.fait}/${avancement.total}`
    : null;

  async function basculerPoint(point: Point) {
    await ecarterPoint(point.id, !point.ecarte);
    const maj = annonce.points.map((p) => (p.id === point.id ? { ...p, ecarte: !p.ecarte } : p));
    await recalculerAnnonce(annonce.id, maj);
    onChangement();
  }

  return (
    <div className="verre-fort overflow-hidden">
      <button
        onClick={() => setOuvert((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={ouvert}
      >
        <span className="puce flex-shrink-0" style={{ color: teinte }}>{LIBELLE_VERDICT[verdict]}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9rem] font-medium truncate">{annonce.reference}</span>
          <span className="block text-[0.8rem] text-doux truncate">
            {annonce.titre || annonce.texte_principal.slice(0, 70) || 'Sans texte'}
          </span>
        </span>
        {retenus.length > 0 && (
          <span className="num text-[0.78rem] text-doux flex-shrink-0">
            {retenus.length} point{retenus.length > 1 ? 's' : ''}
          </span>
        )}
        <ChevronDown size={15} className={`text-doux flex-shrink-0 transition-transform ${ouvert ? 'rotate-180' : ''}`} />
      </button>

      {ouvert && (
        <div className="px-4 pb-4 border-t border-trait">
          <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
            {/* visuel */}
            <div>
              {apercu ? (
                <img src={apercu} alt="" className="w-full rounded-[12px] border border-trait object-cover" />
              ) : (
                <button
                  onClick={() => fichier.current?.click()}
                  className="w-full aspect-square rounded-[12px] border border-dashed border-traitFort grid place-items-center text-doux hover:text-encre transition-colors"
                >
                  {envoi ? (
                    <span className="flex flex-col items-center gap-1.5 text-[0.75rem]">
                      <Loader2 size={18} className="animate-spin" />
                      {libelleAvancement}
                    </span>
                  ) : (
                    <span className="flex flex-col items-center gap-1.5 text-[0.78rem]">
                      <ImageIcon size={18} />
                      Visuel ou vidéo
                    </span>
                  )}
                </button>
              )}
              <input
                ref={fichier} type="file" accept="image/*,video/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void joindreMedia(f); }}
              />
              {apercu && (
                <button className="btn-secondaire mt-2 w-full text-[0.78rem]" onClick={() => fichier.current?.click()}>
                  <RotateCcw size={13} /> Remplacer
                </button>
              )}
              {annonce.format === 'video' && annonce.duree_s && (
                <p className="aide flex items-center gap-1.5">
                  <Film size={12} /> {annonce.duree_s} s · {annonce.visuels?.length ?? 0} images
                </p>
              )}
              {annonce.lecture_visuel && <p className="aide">{annonce.lecture_visuel}</p>}
            </div>

            {/* contenu + points */}
            <div className="min-w-0">
              <p className="text-[0.85rem] leading-relaxed whitespace-pre-wrap">{annonce.texte_principal}</p>
              {annonce.url_destination && (
                <p className="aide break-all">{annonce.url_destination}</p>
              )}

              {bande.length > 1 && (
                <div className="mt-3 -mx-1 flex gap-1.5 overflow-x-auto pb-2">
                  {bande.map((image) => (
                    <figure key={image.timecode} className="flex-shrink-0 w-[74px]">
                      <img src={image.url} alt="" className="w-full rounded-[8px] border border-trait" />
                      <figcaption className="num text-[0.68rem] text-pale text-center mt-1">
                        {image.timecode}s
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {annonce.transcription && (
                <details className="mt-3">
                  <summary className="text-[0.78rem] text-doux cursor-pointer">Transcription</summary>
                  <p className="mt-2 text-[0.82rem] leading-relaxed text-doux whitespace-pre-wrap">
                    {annonce.transcription}
                  </p>
                </details>
              )}

              {annonce.points.length === 0 ? (
                <p className="mt-4 text-[0.84rem] text-menthe">
                  Rien à signaler. Les contrôles automatiques passent.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {annonce.points.map((p) => (
                    <li
                      key={p.id}
                      className={`rounded-[12px] p-3 border transition-opacity ${p.ecarte ? 'opacity-40' : ''}`}
                      style={{ borderColor: `${TEINTE_GRAVITE[p.gravite]}44`, background: `${TEINTE_GRAVITE[p.gravite]}0F` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[0.72rem]" style={{ color: TEINTE_GRAVITE[p.gravite] }}>
                            {LIBELLE_GRAVITE[p.gravite]} · {p.politique}
                          </p>
                          {p.extrait && (
                            <p className="mt-1 text-[0.82rem] font-mono text-encre break-words">« {p.extrait} »</p>
                          )}
                        </div>
                        <button
                          onClick={() => void basculerPoint(p)}
                          className="btn-pas flex-shrink-0"
                          title={p.ecarte ? 'Reprendre ce point' : 'Écarter ce point'}
                          aria-label={p.ecarte ? 'Reprendre ce point' : 'Écarter ce point'}
                        >
                          {p.ecarte ? <Undo2 size={13} /> : <Trash2 size={13} />}
                        </button>
                      </div>
                      <p className="mt-2 text-[0.83rem] text-doux leading-relaxed">{p.pourquoi}</p>
                      <p className="mt-1.5 text-[0.83rem] leading-relaxed">
                        <span className="text-pale">Correction — </span>{p.correction}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => { void supprimerAnnonce(annonce.id).then(onChangement); }}
                className="mt-4 text-[0.78rem] text-pale hover:text-corail transition-colors"
              >
                Retirer cette pub du lot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
