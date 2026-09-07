// Identifiants du projet Supabase.
//
// La clé « anon » est publique par conception : elle part de toute façon
// dans le navigateur, et c'est la RLS qui protège les données. On la place
// ici en secours pour que le projet démarre sans fichier .env, notamment
// dans les environnements en ligne où les fichiers cachés se perdent.
export const SUPABASE_URL_DEFAUT = 'https://sunccpknnwgobfwpprqp.supabase.co';
export const SUPABASE_ANON_DEFAUT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1bmNjcGtubndnb2Jmd3BwcnFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjQxNjEsImV4cCI6MjEwNDM0MDE2MX0.amEbRyht5thCREGbzE4tzuCptxElFQ9ST1HXeJDpl9c';
