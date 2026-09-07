import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Abonnement, Espace } from './types';

interface EtatSession {
  session: Session | null;
  /** L'espace de travail courant. */
  espace: Espace | null;
  abonnement: Abonnement | null;
  /** Tous les espaces de l'utilisateur. */
  espaces: Espace[];
  chargement: boolean;
  /** Connecté, mais rattaché à aucun espace : premier lancement. */
  sansEspace: boolean;
  changerEspace: (id: string) => void;
  creerEspace: (nom: string) => Promise<void>;
  rafraichir: () => Promise<void>;
  deconnecter: () => Promise<void>;
}

const CLE_ESPACE = 'gaby.espace';

const Contexte = createContext<EtatSession | null>(null);

export function FournisseurSession({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [chargement, setChargement] = useState(true);
  const [sansEspace, setSansEspace] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(() => localStorage.getItem(CLE_ESPACE));

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const charger = useCallback(async () => {
    if (!session) {
      setEspaces([]); setAbonnement(null); setSansEspace(false); setChargement(false);
      return;
    }
    setChargement(true);

    const { data } = await supabase
      .from('membres')
      .select('espace:espaces(id, nom, signature, logo_chemin, fuseau, cree_le)')
      .order('cree_le', { ascending: true });

    const liste = ((data ?? []) as unknown as { espace: Espace | null }[])
      .map((m) => m.espace)
      .filter((e): e is Espace => e !== null);
    setEspaces(liste);

    if (!liste.length) {
      setSansEspace(true); setAbonnement(null); setChargement(false);
      return;
    }
    setSansEspace(false);

    const actuel = liste.find((e) => e.id === choisi)?.id ?? liste[0].id;
    if (actuel !== choisi) { setChoisi(actuel); localStorage.setItem(CLE_ESPACE, actuel); }

    const { data: abo } = await supabase
      .from('abonnements').select('*').eq('espace_id', actuel).maybeSingle();
    setAbonnement((abo as Abonnement) ?? null);
    setChargement(false);
  }, [session, choisi]);

  useEffect(() => { void charger(); }, [charger]);

  const changerEspace = useCallback((id: string) => {
    localStorage.setItem(CLE_ESPACE, id);
    setChoisi(id);
  }, []);

  const creerEspace = useCallback(async (nom: string) => {
    const { data, error } = await supabase.rpc('creer_espace', { p_nom: nom });
    if (error) throw error;
    localStorage.setItem(CLE_ESPACE, data as string);
    setChoisi(data as string);
  }, []);

  const valeur = useMemo<EtatSession>(() => ({
    session,
    espace: espaces.find((e) => e.id === choisi) ?? espaces[0] ?? null,
    abonnement,
    espaces,
    chargement,
    sansEspace,
    changerEspace,
    creerEspace,
    rafraichir: charger,
    deconnecter: async () => { await supabase.auth.signOut(); },
  }), [session, espaces, choisi, abonnement, chargement, sansEspace, changerEspace, creerEspace, charger]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): EtatSession {
  const v = useContext(Contexte);
  if (!v) throw new Error('useSession doit être utilisé dans FournisseurSession');
  return v;
}

/** Raccourci pour les écrans, qui ne s'affichent qu'une fois l'espace connu. */
export function useEspace(): Espace {
  const { espace } = useSession();
  if (!espace) throw new Error('Aucun espace chargé');
  return espace;
}
