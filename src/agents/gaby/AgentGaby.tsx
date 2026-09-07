import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, LayoutGrid, Loader2, LogOut, Plus, ScanLine } from 'lucide-react';
import { useSession } from '@/lib/session';
import SelecteurEspace from '@/components/SelecteurEspace';
import { dateCourte } from '@/lib/format';
import DepotAnnonces from './DepotAnnonces';
import FicheAnnonce from './FicheAnnonce';
import ReponseClient from './ReponseClient';
import {
  ajouterAnnonces, ajouterVideos, analyserLot, chargerAnnonces, chargerClients, chargerLots,
  creerClient, creerLot, passerControlesAuto, supprimerLot,
  type AvancementVideo, type BrouillonAnnonce,
} from './api';
import { estUneVideo } from './video';
import {
  LIBELLE_VERTICALE, TEINTE_VERDICT,
  type AnnonceDetaillee, type ClientPub, type Lot, type Verticale,
} from './types';

interface AgentGabyProps {
  onChangerAgent: () => void;
}

export default function AgentGaby({ onChangerAgent }: AgentGabyProps) {
  const { espace, deconnecter } = useSession();
  const espaceId = espace!.id;

  const [clients, setClients] = useState<ClientPub[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotId, setLotId] = useState<string | null>(null);
  const [annonces, setAnnonces] = useState<AnnonceDetaillee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [depot, setDepot] = useState(false);
  const [analyse, setAnalyse] = useState(false);
  const [nouveauLot, setNouveauLot] = useState(false);
  const [depotVideo, setDepotVideo] = useState<{ nom: string; a: AvancementVideo } | null>(null);
  const fichiersVideo = useRef<HTMLInputElement>(null);

  const lot = lots.find((l) => l.id === lotId) ?? null;
  const verticale: Verticale = lot?.client?.verticale ?? 'autre';

  const charger = useCallback(async () => {
    try {
      setErreur(null);
      const [c, l] = await Promise.all([chargerClients(espaceId), chargerLots(espaceId)]);
      setClients(c);
      setLots(l);
      setLotId((actuel) => actuel ?? l[0]?.id ?? null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, [espaceId]);

  useEffect(() => { void charger(); }, [charger]);

  const chargerLeLot = useCallback(async () => {
    if (!lotId) { setAnnonces([]); return; }
    setAnnonces(await chargerAnnonces(lotId));
  }, [lotId]);

  useEffect(() => { void chargerLeLot(); }, [chargerLeLot]);

  async function rafraichir() {
    await Promise.all([charger(), chargerLeLot()]);
  }

  async function ajouter(brouillons: BrouillonAnnonce[]) {
    if (!lotId) return;
    setAnnonces(await ajouterAnnonces(espaceId, lotId, brouillons, verticale));
    void charger();
  }

  async function deposerVideos(liste: File[]) {
    if (!lotId) return;
    const videos = liste.filter(estUneVideo);
    if (!videos.length) return;
    setErreur(null);
    try {
      setAnnonces(await ajouterVideos(espaceId, lotId, videos, verticale,
        (nom, a) => setDepotVideo({ nom, a })));
      void charger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Une vidéo n'a pas pu être traitée.");
    } finally {
      setDepotVideo(null);
    }
  }

  async function lancerAnalyse() {
    if (!lotId) return;
    setAnalyse(true); setErreur(null);
    try {
      await analyserLot(espaceId, lotId);
      // La transcription n'existe qu'après l'analyse : on repasse les
      // contrôles automatiques dessus, ils y trouvent souvent l'essentiel.
      const apres = await chargerAnnonces(lotId);
      await Promise.all(
        apres.filter((a) => a.transcription).map((a) => passerControlesAuto(espaceId, a, verticale)),
      );
      await rafraichir();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'analyse n'a pas abouti.");
    } finally {
      setAnalyse(false);
    }
  }

  const bloquantes = annonces.filter((a) => a.verdict === 'refus_probable').length;
  const aCorriger = annonces.filter((a) => a.verdict === 'a_corriger').length;
  const propres = annonces.filter((a) => a.verdict === 'conforme').length;

  if (chargement) {
    return <div className="dessus min-h-screen grid place-items-center"><p className="text-[0.9rem] text-doux">Chargement…</p></div>;
  }

  return (
    <div className="dessus min-h-screen">
      <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-trait">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-[26px] h-[26px] rounded-[9px] flex-shrink-0"
            style={{ background: 'linear-gradient(150deg,#22D3EE,#818CF8)', boxShadow: '0 0 18px rgba(129,140,248,.55)' }} />
          <div className="min-w-0">
            <p className="text-[0.98rem] font-semibold tracking-tight leading-tight">Gaby</p>
            <p className="text-[0.75rem] text-doux leading-tight">Conformité publicitaire</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SelecteurEspace compact />
          <button onClick={onChangerAgent} className="btn-pas" title="Changer d'agent" aria-label="Changer d'agent">
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => void deconnecter()} className="btn-pas" title="Se déconnecter" aria-label="Se déconnecter">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="px-5 md:px-8 py-6 grid gap-6 lg:grid-cols-[290px_1fr] max-w-[1400px] mx-auto">
        {/* ------------------------------------------------ file d'attente */}
        <aside className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="titre-section">À vérifier</h2>
            <button onClick={() => setNouveauLot((v) => !v)} className="btn-pas" title="Nouveau lot" aria-label="Nouveau lot">
              <Plus size={14} />
            </button>
          </div>

          {nouveauLot && (
            <FormulaireLot
              clients={clients}
              espaceId={espaceId}
              onCree={async (l) => { setNouveauLot(false); await charger(); setLotId(l.id); setDepot(true); }}
            />
          )}

          <ul className="mt-4 space-y-2">
            {lots.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setLotId(l.id)}
                  className={`w-full text-left rounded-[12px] px-3.5 py-3 border transition-colors ${
                    l.id === lotId ? 'border-cyan bg-panneauFort' : 'border-trait hover:border-traitFort'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.88rem] font-medium truncate">{l.client?.nom ?? 'Client'}</span>
                    {l.statut === 'repondu' ? (
                      <span className="text-[0.72rem] text-menthe flex-shrink-0">répondu</span>
                    ) : l.nb_bloquantes ? (
                      <span className="num text-[0.72rem] text-corail flex-shrink-0">{l.nb_bloquantes} bloquée{l.nb_bloquantes > 1 ? 's' : ''}</span>
                    ) : null}
                  </div>
                  <p className="text-[0.79rem] text-doux truncate">{l.titre}</p>
                  <p className="text-[0.74rem] text-pale mt-0.5">
                    {dateCourte(l.cree_le)} · {l.nb_annonces ?? 0} pub{(l.nb_annonces ?? 0) > 1 ? 's' : ''}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {lots.length === 0 && (
            <p className="aide mt-4">
              Aucun lot pour l'instant. Créez-en un dès qu'un client vous envoie ses pubs.
            </p>
          )}
        </aside>

        {/* --------------------------------------------------- lot courant */}
        <section className="min-w-0 space-y-5">
          {erreur && (
            <div className="verre p-4 border-corail/40">
              <p className="text-[0.85rem] text-corail">{erreur}</p>
            </div>
          )}

          {!lot ? (
            <div className="verre p-8 text-center">
              <p className="text-[0.9rem] text-doux">Choisissez un lot à gauche, ou créez-en un.</p>
            </div>
          ) : (
            <>
              <div className="verre p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.75rem] text-doux">
                      {lot.client?.nom} · {LIBELLE_VERTICALE[verticale]}
                    </p>
                    <h1 className="text-[1.3rem] font-semibold tracking-tight">{lot.titre}</h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="btn-secondaire" onClick={() => setDepot((v) => !v)}>
                      <Plus size={14} /> Ajouter des pubs
                    </button>
                    <button className="btn-secondaire" onClick={() => fichiersVideo.current?.click()}
                      disabled={depotVideo !== null}>
                      <Film size={14} /> Déposer des vidéos
                    </button>
                    <input
                      ref={fichiersVideo} type="file" accept="video/*" multiple className="hidden"
                      onChange={(e) => { void deposerVideos([...(e.target.files ?? [])]); e.target.value = ''; }}
                    />
                    <button className="btn-primaire" onClick={() => void lancerAnalyse()} disabled={analyse || annonces.length === 0}>
                      {analyse ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
                      {analyse ? 'Vérification…' : 'Vérifier le lot'}
                    </button>
                  </div>
                </div>

                {annonces.length > 0 && (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    <Compteur valeur={propres} libelle="diffusables" teinte={TEINTE_VERDICT.conforme} total={annonces.length} />
                    <Compteur valeur={aCorriger} libelle="à corriger" teinte={TEINTE_VERDICT.a_corriger} total={annonces.length} />
                    <Compteur valeur={bloquantes} libelle="seront refusées" teinte={TEINTE_VERDICT.refus_probable} total={annonces.length} />
                  </div>
                )}

                {depotVideo && (
                  <div className="mt-4 verre-fort px-3.5 py-3">
                    <p className="text-[0.82rem] truncate">{depotVideo.nom}</p>
                    <p className="text-[0.76rem] text-doux mt-0.5">
                      {depotVideo.a.etape === 'images'
                        ? `Découpage des images ${depotVideo.a.fait}/${depotVideo.a.total}`
                        : depotVideo.a.etape === 'audio'
                          ? 'Extraction de la bande son'
                          : `Envoi ${depotVideo.a.fait}/${depotVideo.a.total}`}
                    </p>
                    <div className="barre-fine mt-2">
                      <i style={{ width: `${(depotVideo.a.fait / Math.max(1, depotVideo.a.total)) * 100}%` }} />
                    </div>
                  </div>
                )}

                {lot.analyse_le && (
                  <p className="aide">
                    Vérifié le {dateCourte(lot.analyse_le)}. Meta garde le dernier mot : ce contrôle anticipe sa décision.
                  </p>
                )}
              </div>

              {depot && <DepotAnnonces onAjouter={ajouter} onFermer={() => setDepot(false)} />}

              {annonces.length === 0 ? (
                <div className="verre p-8 text-center">
                  <p className="text-[0.9rem] text-doux">Ce lot est vide.</p>
                  <button className="btn-primaire mt-4" onClick={() => setDepot(true)}>
                    <Plus size={15} /> Ajouter les pubs du client
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {annonces.map((a) => (
                    <FicheAnnonce key={a.id} annonce={a} espaceId={espaceId} onChangement={() => void rafraichir()} />
                  ))}
                </div>
              )}

              {annonces.length > 0 && (
                <ReponseClient
                  lot={lot}
                  espaceId={espaceId}
                  pretARediger={annonces.some((a) => a.verdict !== null)}
                  onChangement={() => void rafraichir()}
                />
              )}

              <button
                onClick={() => { void supprimerLot(lot.id).then(() => { setLotId(null); void charger(); }); }}
                className="text-[0.78rem] text-pale hover:text-corail transition-colors"
              >
                Supprimer ce lot
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

// ------------------------------------------------------------ compteur

function Compteur({ valeur, libelle, teinte, total }: { valeur: number; libelle: string; teinte: string; total: number }) {
  return (
    <div className="verre-fort px-3.5 py-3">
      <p className="num text-[1.4rem] leading-none" style={{ color: teinte }}>{valeur}</p>
      <p className="text-[0.76rem] text-doux mt-1.5">{libelle}</p>
      <div className="barre-fine mt-2" style={{ ['--teinte' as string]: teinte }}>
        <i style={{ width: `${total ? (valeur / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// -------------------------------------------------------- création lot

function FormulaireLot({
  clients, espaceId, onCree,
}: { clients: ClientPub[]; espaceId: string; onCree: (lot: Lot) => void | Promise<void> }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [titre, setTitre] = useState('');
  const [nouveauClient, setNouveauClient] = useState(clients.length === 0);
  const [nom, setNom] = useState('');
  const [verticale, setVerticale] = useState<Verticale>('ecommerce');
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider() {
    setTravail(true); setErreur(null);
    try {
      let cible = clientId;
      if (nouveauClient) {
        if (!nom.trim()) throw new Error('Il manque le nom du client.');
        cible = (await creerClient(espaceId, { nom: nom.trim(), verticale })).id;
      }
      const defaut = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
      await onCree(await creerLot(espaceId, cible, titre.trim() || `Envoi du ${defaut}`));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Création impossible.');
    } finally {
      setTravail(false);
    }
  }

  return (
    <div className="verre-fort p-4 mt-3">
      {nouveauClient ? (
        <>
          <label className="etiq" htmlFor="lot-nom">Nouveau client</label>
          <input id="lot-nom" className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du client" />
          <label className="etiq mt-3" htmlFor="lot-vert">Secteur</label>
          <select id="lot-vert" className="choix" value={verticale} onChange={(e) => setVerticale(e.target.value as Verticale)}>
            {Object.entries(LIBELLE_VERTICALE).map(([cle, libelle]) => (
              <option key={cle} value={cle}>{libelle}</option>
            ))}
          </select>
          {clients.length > 0 && (
            <button className="suggestion mt-3" onClick={() => setNouveauClient(false)}>Choisir un client existant</button>
          )}
        </>
      ) : (
        <>
          <label className="etiq" htmlFor="lot-client">Client</label>
          <select id="lot-client" className="choix" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button className="suggestion mt-3" onClick={() => setNouveauClient(true)}>Nouveau client</button>
        </>
      )}

      <label className="etiq mt-3" htmlFor="lot-titre">Intitulé du lot</label>
      <input id="lot-titre" className="champ" value={titre} onChange={(e) => setTitre(e.target.value)}
        placeholder="Soldes janvier, Black Friday…" />

      {erreur && <p className="mt-2 text-[0.8rem] text-corail">{erreur}</p>}

      <button className="btn-primaire mt-4 w-full" onClick={() => void valider()} disabled={travail}>
        {travail ? 'Création…' : 'Créer le lot'}
      </button>
    </div>
  );
}
