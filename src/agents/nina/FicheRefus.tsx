import { useEffect, useRef, useState } from 'react';
import {
  BookPlus, Check, Copy, ImagePlus, Loader2, ScanLine, Trash2, X,
} from 'lucide-react';
import {
  ajouterCapture, analyserRefus, changerStatut, enregistrerRefus, redigerRevision,
  retirerCapture, supprimerRefus, urlCapture, verserEnRegle,
} from './api';
import {
  LIBELLE_NIVEAU, LIBELLE_STRATEGIE, TEINTE_NIVEAU,
  type Refus,
} from './types';

interface FicheProps {
  refus: Refus;
  espaceId: string;
  onChangement: () => void;
}

export default function FicheRefus({ refus, espaceId, onChangement }: FicheProps) {
  const [apercus, setApercus] = useState<{ chemin: string; url: string }[]>([]);
  const [travail, setTravail] = useState<null | 'capture' | 'analyse' | 'revision'>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);
  const [regleAjoutee, setRegleAjoutee] = useState(false);
  const [resolution, setResolution] = useState(refus.resolution ?? '');
  const fichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivant = true;
    void Promise.all(
      (refus.captures ?? []).map(async (c) => ({ chemin: c, url: await urlCapture(c) })),
    ).then((liste) => {
      if (vivant) {
        setApercus(liste.filter((l): l is { chemin: string; url: string } => l.url !== null));
      }
    });
    return () => { vivant = false; };
  }, [refus.captures]);

  useEffect(() => {
    setResolution(refus.resolution ?? '');
    setRegleAjoutee(false);
  }, [refus.id, refus.resolution]);

  async function deposer(f: File) {
    setTravail('capture'); setErreur(null);
    try {
      await ajouterCapture(espaceId, refus, f);
      onChangement();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setTravail(null);
    }
  }

  async function lancer() {
    setTravail('analyse'); setErreur(null);
    try {
      await analyserRefus(espaceId, refus.id);
      onChangement();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setTravail(null);
    }
  }

  async function revision() {
    setTravail('revision'); setErreur(null);
    try {
      await redigerRevision(espaceId, refus.id);
      onChangement();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Rédaction impossible.");
    } finally {
      setTravail(null);
    }
  }

  async function copier(texte: string, cle: string) {
    await navigator.clipboard.writeText(texte);
    setCopie(cle);
    window.setTimeout(() => setCopie(null), 1800);
  }

  async function verser() {
    if (!refus.cause || !refus.correction) return;
    await verserEnRegle(espaceId, refus, {
      motif: refus.motif_affiche ?? refus.reference,
      gravite: 'bloquant',
      pourquoi: refus.cause,
      correction: refus.correction,
    });
    setRegleAjoutee(true);
  }

  const analyse = refus.analyse_le !== null;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------- en-tête */}
      <div className="verre p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.75rem] text-doux">{refus.client?.nom}</p>
            <h1 className="text-[1.3rem] font-semibold tracking-tight">{refus.reference}</h1>
            <span className="puce mt-2 inline-block" style={{ color: TEINTE_NIVEAU[refus.niveau] }}>
              {LIBELLE_NIVEAU[refus.niveau]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondaire" onClick={() => fichier.current?.click()} disabled={travail !== null}>
              {travail === 'capture' ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              Ajouter une capture
            </button>
            <button
              className="btn-primaire" onClick={() => void lancer()}
              disabled={travail !== null || apercus.length === 0}
            >
              {travail === 'analyse' ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
              {analyse ? 'Relancer' : 'Diagnostiquer'}
            </button>
            <input
              ref={fichier} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void deposer(f); e.target.value = ''; }}
            />
          </div>
        </div>

        {apercus.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {apercus.map((a) => (
              <div key={a.chemin} className="relative flex-shrink-0">
                <img src={a.url} alt="" className="h-[150px] rounded-[10px] border border-trait" />
                <button
                  onClick={() => { void retirerCapture(refus, a.chemin).then(onChangement); }}
                  className="btn-pas absolute top-1.5 right-1.5"
                  aria-label="Retirer cette capture"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="aide">
            Déposez la capture de la notification Meta : le bandeau du gestionnaire de publicités,
            le mail reçu, ou l'écran de la Page. Plusieurs captures valent mieux qu'une.
          </p>
        )}

        {erreur && <p className="mt-3 text-[0.82rem] text-corail">{erreur}</p>}
      </div>

      {/* --------------------------------------------------- résultat */}
      {analyse && (
        <>
          <div className="verre p-5">
            <h3 className="titre-section">Ce que Meta reproche</h3>
            {refus.motif_affiche && (
              <p className="mt-3 text-[0.85rem] font-mono">« {refus.motif_affiche} »</p>
            )}
            {refus.politique && <p className="aide">Règle citée : {refus.politique}</p>}

            <h3 className="titre-section mt-5">Ce qui l'a réellement déclenché</h3>
            <p className="mt-2 text-[0.87rem] leading-relaxed">{refus.cause}</p>

            {refus.faux_positif && (
              <p className="mt-3 text-[0.83rem] text-menthe leading-relaxed">
                La création semble conforme. C'est probablement un faux positif de la revue
                automatique — la demande de révision a de bonnes chances d'aboutir.
              </p>
            )}

            <h3 className="titre-section mt-5">Ce qu'il faut faire</h3>
            <p className="mt-2 text-[0.87rem] leading-relaxed">{refus.correction}</p>
            {refus.strategie && (
              <p className="mt-3">
                <span className="jeton">{LIBELLE_STRATEGIE[refus.strategie]}</span>
              </p>
            )}
          </div>

          {refus.texte_corrige && (
            <div className="verre p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="titre-section">Version corrigée</h3>
                <button className="btn-secondaire" onClick={() => void copier(refus.texte_corrige!, 'texte')}>
                  {copie === 'texte' ? <Check size={14} /> : <Copy size={14} />} Copier
                </button>
              </div>
              <p className="mt-3 text-[0.87rem] leading-relaxed whitespace-pre-wrap">{refus.texte_corrige}</p>
            </div>
          )}

          <div className="verre p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="titre-section">Demande de révision</h3>
                <p className="sous-section">À coller dans le formulaire de contestation Meta.</p>
              </div>
              <div className="flex items-center gap-2">
                {refus.demande_revision && (
                  <button className="btn-secondaire" onClick={() => void copier(refus.demande_revision!, 'revision')}>
                    {copie === 'revision' ? <Check size={14} /> : <Copy size={14} />} Copier
                  </button>
                )}
                <button className="btn-secondaire" onClick={() => void revision()} disabled={travail !== null}>
                  {travail === 'revision' ? <Loader2 size={14} className="animate-spin" /> : null}
                  {refus.demande_revision ? 'Réécrire' : 'Rédiger'}
                </button>
              </div>
            </div>
            {refus.demande_revision && (
              <textarea
                className="zone mt-3 text-[0.86rem]"
                rows={Math.min(16, Math.max(6, refus.demande_revision.split('\n').length + 2))}
                defaultValue={refus.demande_revision}
                onBlur={(e) => { void enregistrerRefus(refus.id, { demande_revision: e.target.value }); }}
              />
            )}
          </div>

          {/* ------------------------------------------- apprentissage */}
          <div className="verre p-5">
            <h3 className="titre-section">Ce qui a débloqué</h3>
            <p className="sous-section">
              Une fois la pub repassée, notez ce qui a marché. C'est ce qui rend Gaby plus juste
              sur vos clients que sur la moyenne du marché.
            </p>
            <textarea
              className="zone mt-3 text-[0.86rem]" rows={3} value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              onBlur={() => { void enregistrerRefus(refus.id, { resolution }); }}
              placeholder="Retiré la mention du montant, repassé en 20 minutes."
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-primaire"
                onClick={() => { void changerStatut(refus.id, 'resolu').then(onChangement); }}
                disabled={refus.statut === 'resolu'}
              >
                <Check size={15} /> {refus.statut === 'resolu' ? 'Débloqué' : 'Marquer débloqué'}
              </button>
              <button className="btn-secondaire" onClick={() => void verser()} disabled={regleAjoutee}>
                {regleAjoutee ? <Check size={14} /> : <BookPlus size={14} />}
                {regleAjoutee ? 'Ajoutée aux règles' : 'Ajouter aux règles maison'}
              </button>
              <button
                className="btn-secondaire"
                onClick={() => { void changerStatut(refus.id, 'perdu').then(onChangement); }}
              >
                Abandonner
              </button>
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => { void supprimerRefus(refus.id).then(onChangement); }}
        className="text-[0.78rem] text-pale hover:text-corail transition-colors inline-flex items-center gap-1.5"
      >
        <Trash2 size={12} /> Supprimer ce refus
      </button>
    </div>
  );
}
