import { useCallback, useEffect, useState } from 'react';
import { LayoutGrid, LogOut, Plus } from 'lucide-react';
import { useSession } from '@/lib/session';
import SelecteurEspace from '@/components/SelecteurEspace';
import { dateCourte } from '@/lib/format';
import { chargerClients, creerClient } from '@/agents/gaby/api';
import { LIBELLE_VERTICALE, type ClientPub, type Verticale } from '@/agents/gaby/types';
import FicheRefus from './FicheRefus';
import { chargerRefus, creerRefus } from './api';
import { LIBELLE_STATUT, TEINTE_STATUT, type Refus } from './types';

export default function AgentNina({ onChangerAgent }: { onChangerAgent: () => void }) {
  const { espace, deconnecter } = useSession();
  const espaceId = espace!.id;

  const [refus, setRefus] = useState<Refus[]>([]);
  const [clients, setClients] = useState<ClientPub[]>([]);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);

  const charger = useCallback(async () => {
    try {
      setErreur(null);
      const [liste, cl] = await Promise.all([chargerRefus(espaceId), chargerClients(espaceId)]);
      setRefus(liste);
      setClients(cl);
      setChoisi((actuel) => (actuel && liste.some((r) => r.id === actuel) ? actuel : liste[0]?.id ?? null));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      setChargement(false);
    }
  }, [espaceId]);

  useEffect(() => { void charger(); }, [charger]);

  const courant = refus.find((r) => r.id === choisi) ?? null;
  const aTraiter = refus.filter((r) => r.statut === 'nouveau').length;

  if (chargement) {
    return (
      <div className="dessus min-h-screen grid place-items-center">
        <p className="text-[0.9rem] text-doux">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="dessus min-h-screen">
      <header className="flex items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-trait">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-[26px] h-[26px] rounded-[9px] flex-shrink-0"
            style={{ background: 'linear-gradient(150deg,#F472B6,#A78BFA)', boxShadow: '0 0 18px rgba(167,139,250,.5)' }}
          />
          <div className="min-w-0">
            <p className="text-[0.98rem] font-semibold tracking-tight leading-tight">Nina</p>
            <p className="text-[0.75rem] text-doux leading-tight">Après-refus</p>
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
        <aside className="min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="titre-section">
              Refus{aTraiter > 0 && <span className="num text-corail"> · {aTraiter}</span>}
            </h2>
            <button onClick={() => setNouveau((v) => !v)} className="btn-pas" title="Nouveau refus" aria-label="Nouveau refus">
              <Plus size={14} />
            </button>
          </div>

          {nouveau && (
            <FormulaireRefus
              clients={clients}
              espaceId={espaceId}
              onCree={async (r) => { setNouveau(false); await charger(); setChoisi(r.id); }}
            />
          )}

          <ul className="mt-4 space-y-2">
            {refus.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setChoisi(r.id)}
                  className={`w-full text-left rounded-[12px] px-3.5 py-3 border transition-colors ${
                    r.id === choisi ? 'border-cyan bg-panneauFort' : 'border-trait hover:border-traitFort'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.88rem] font-medium truncate">{r.reference}</span>
                    <span className="text-[0.72rem] flex-shrink-0" style={{ color: TEINTE_STATUT[r.statut] }}>
                      {LIBELLE_STATUT[r.statut]}
                    </span>
                  </div>
                  <p className="text-[0.79rem] text-doux truncate">{r.client?.nom}</p>
                  <p className="text-[0.74rem] text-pale mt-0.5">{dateCourte(r.cree_le)}</p>
                </button>
              </li>
            ))}
          </ul>

          {refus.length === 0 && (
            <p className="aide mt-4">
              Aucun refus enregistré. Dès qu'une pub tombe, créez-en un et déposez la capture.
            </p>
          )}
        </aside>

        <section className="min-w-0">
          {erreur && (
            <div className="verre p-4 border-corail/40 mb-5">
              <p className="text-[0.85rem] text-corail">{erreur}</p>
            </div>
          )}

          {courant ? (
            <FicheRefus refus={courant} espaceId={espaceId} onChangement={() => void charger()} />
          ) : (
            <div className="verre p-8 text-center">
              <p className="text-[0.9rem] text-doux">
                Sélectionnez un refus, ou créez-en un.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function FormulaireRefus({
  clients, espaceId, onCree,
}: { clients: ClientPub[]; espaceId: string; onCree: (r: Refus) => void | Promise<void> }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [reference, setReference] = useState('');
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
      await onCree(await creerRefus(espaceId, {
        client_id: cible,
        reference: reference.trim() || `Refus du ${defaut}`,
      }));
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
          <label className="etiq" htmlFor="refus-nom">Nouveau client</label>
          <input id="refus-nom" className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du client" />
          <label className="etiq mt-3" htmlFor="refus-vert">Secteur</label>
          <select id="refus-vert" className="choix" value={verticale} onChange={(e) => setVerticale(e.target.value as Verticale)}>
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
          <label className="etiq" htmlFor="refus-client">Client</label>
          <select id="refus-client" className="choix" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button className="suggestion mt-3" onClick={() => setNouveauClient(true)}>Nouveau client</button>
        </>
      )}

      <label className="etiq mt-3" htmlFor="refus-ref">Référence de la pub</label>
      <input
        id="refus-ref" className="champ" value={reference}
        onChange={(e) => setReference(e.target.value)} placeholder="2057-1, Pub soldes…"
      />

      {erreur && <p className="mt-2 text-[0.8rem] text-corail">{erreur}</p>}

      <button className="btn-primaire mt-4 w-full" onClick={() => void valider()} disabled={travail}>
        {travail ? 'Création…' : 'Créer'}
      </button>
    </div>
  );
}
