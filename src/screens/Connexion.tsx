import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BASELINE, MARQUE } from '@/lib/marque';

type Mode = 'connexion' | 'inscription';

export default function Connexion() {
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [travail, setTravail] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function valider() {
    if (!email.trim() || !motDePasse) { setErreur('Email et mot de passe sont requis.'); return; }
    if (mode === 'inscription' && motDePasse.length < 8) {
      setErreur('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setTravail(true); setErreur(null); setMessage(null);

    const { error, data } =
      mode === 'connexion'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password: motDePasse })
        : await supabase.auth.signUp({ email: email.trim(), password: motDePasse });

    if (error) {
      setErreur(traduire(error.message));
      setTravail(false);
      return;
    }
    // Si la confirmation par email est active, aucune session n'est ouverte.
    if (mode === 'inscription' && !data.session) {
      setMessage("Compte créé. Vérifiez votre boîte mail pour confirmer l'adresse, puis connectez-vous.");
      setMode('connexion');
      setTravail(false);
      return;
    }
    // Sinon la session s'ouvre et l'application prend le relais.
  }

  return (
    <div className="dessus min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-7">
          <span
            className="w-[30px] h-[30px] rounded-[10px]"
            style={{ background: 'linear-gradient(150deg,#22D3EE,#818CF8)', boxShadow: '0 0 20px rgba(129,140,248,.5)' }}
          />
          <div>
            <p className="text-[1.05rem] font-semibold tracking-tight leading-tight">{MARQUE}</p>
            <p className="text-[0.76rem] text-doux leading-tight">{BASELINE}</p>
          </div>
        </div>

        <div className="verre p-6">
          <div className="segment mb-5">
            <button data-on={mode === 'connexion'} onClick={() => { setMode('connexion'); setErreur(null); }}>
              Se connecter
            </button>
            <button data-on={mode === 'inscription'} onClick={() => { setMode('inscription'); setErreur(null); }}>
              Créer un compte
            </button>
          </div>

          <label className="etiq" htmlFor="email">Email</label>
          <input
            id="email" className="champ" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="etiq mt-3" htmlFor="mdp">Mot de passe</label>
          <input
            id="mdp" className="champ" type="password" value={motDePasse}
            autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
            onChange={(e) => setMotDePasse(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void valider(); }}
          />

          {erreur && <p className="mt-3 text-[0.82rem] text-corail">{erreur}</p>}
          {message && <p className="mt-3 text-[0.82rem] text-menthe">{message}</p>}

          <button className="btn-primaire mt-5 w-full" onClick={() => void valider()} disabled={travail}>
            {travail && <Loader2 size={15} className="animate-spin" />}
            {mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Les messages de Supabase arrivent en anglais et sont peu parlants. */
function traduire(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return "Adresse non confirmée : vérifiez votre boîte mail.";
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Un compte existe déjà avec cette adresse.';
  }
  if (m.includes('rate limit')) return 'Trop de tentatives. Réessayez dans une minute.';
  return message;
}
