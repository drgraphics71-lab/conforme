// Découpage d'un envoi client collé en bloc, vers des annonces séparées.
import type { BrouillonAnnonce } from './api';

/** Découpe un bloc collé en plusieurs annonces.
 *  Séparateur : une ligne de tirets, ou une ligne vide entre deux « Pub … ».
 *  Champs reconnus : texte, titre, description, bouton/cta, lien/url. */
export function analyserColle(brut: string): BrouillonAnnonce[] {
  const blocs = brut
    .split(/\n\s*(?:-{3,}|={3,}|_{3,})\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocs.map((bloc, index) => {
    const lignes = bloc.split('\n');
    const annonce: BrouillonAnnonce = { reference: `Pub ${index + 1}`, texte_principal: '' };
    const reste: string[] = [];

    for (const ligne of lignes) {
      const champ = /^\s*(référence|reference|ref|texte(?:\s+principal)?|titre|description|bouton|cta|lien|url|page)\s*:\s*(.*)$/i.exec(ligne);
      if (!champ) { reste.push(ligne); continue; }
      const [, cle, valeur] = champ;
      const c = cle.toLowerCase();
      if (c.startsWith('réf') || c.startsWith('ref')) annonce.reference = valeur.trim() || annonce.reference;
      else if (c.startsWith('texte')) annonce.texte_principal = valeur.trim();
      else if (c === 'titre') annonce.titre = valeur.trim();
      else if (c === 'description') annonce.description = valeur.trim();
      else if (c === 'bouton' || c === 'cta') annonce.cta = valeur.trim();
      else annonce.url_destination = valeur.trim();
    }

    // Les lignes sans étiquette complètent le texte principal ; la première
    // ligne courte du bloc sert de référence si aucune n'a été donnée.
    const libres = reste.map((l) => l.trim()).filter(Boolean);
    if (libres.length && !annonce.texte_principal) {
      if (libres.length > 1 && libres[0].length < 40) {
        annonce.reference = libres[0];
        annonce.texte_principal = libres.slice(1).join('\n');
      } else {
        annonce.texte_principal = libres.join('\n');
      }
    } else if (libres.length) {
      annonce.texte_principal = `${annonce.texte_principal}\n${libres.join('\n')}`.trim();
    }

    const lien = /https?:\/\/\S+/.exec(bloc);
    if (!annonce.url_destination && lien) annonce.url_destination = lien[0];

    return annonce;
  });
}
