# Conforme — vérification des publicités Meta

Projet Vite + React + TypeScript + Supabase.

## Import dans Bolt

Le projet démarre sans configuration : les identifiants Supabase sont dans
`src/lib/config.ts`, et un `.env` les remplace s'il existe.

Bolt lance `npm install` puis `npm run dev` tout seul.

## Base de données

Les tables sont déjà créées sur le projet Supabase « Agence IA ». Le SQL est
conservé dans `supabase/migrations/` pour référence, il n'y a rien à rejouer.

## Avant de créer un compte

Dans Supabase, Authentication → Sign In / Providers → Email : décocher
« Confirm email ». Sinon la création de compte échoue, l'envoi de mails
n'étant pas configuré.

## Le reste

Voir LISEZMOI.md : fonctionnement de Gaby, règles de conformité, traitement
des vidéos, déploiement de la fonction d'analyse.
