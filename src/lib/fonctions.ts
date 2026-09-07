import { FunctionsHttpError } from '@supabase/supabase-js';

/** supabase.functions.invoke ne remonte pas le corps de la réponse quand le
 *  code HTTP n'est pas 2xx : on reçoit « Edge Function returned a non-2xx
 *  status code » et rien d'autre. On va donc chercher le message réel dans
 *  la réponse, sinon toute erreur serveur devient indéchiffrable. */
export async function messageErreur(erreur: unknown): Promise<string> {
  if (erreur instanceof FunctionsHttpError) {
    try {
      const corps = await erreur.context.json();
      if (corps?.erreur) return String(corps.erreur);
    } catch {
      // Corps illisible : on retombe sur le message générique.
    }
  }
  return erreur instanceof Error ? erreur.message : 'Erreur inattendue';
}
