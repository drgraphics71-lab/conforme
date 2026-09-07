const JOURS_COURTS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
const JOURS_LONGS = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];
const MOIS_COURTS = [
  'jan', 'fév', 'mar', 'avr', 'mai', 'juin',
  'juil', 'août', 'sep', 'oct', 'nov', 'déc',
];
const MOIS_LONGS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function dateCourte(iso: string): string {
  const d = new Date(iso);
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}

export function dateLongue(iso: string): string {
  const d = new Date(iso);
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

export function heure(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function moisLong(iso: string): string {
  const d = new Date(iso);
  return `${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Valeur pour <input type="date"> en heure locale. */
export function versChampDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Recompose un ISO à partir des deux champs date et heure du formulaire. */
export function depuisChamps(date: string, hhmm: string): string {
  const [a, m, j] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(a, m - 1, j, h, min).toISOString();
}

/** Numéro de semaine ISO 8601. */
export function numeroSemaine(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - debut.getTime()) / 86400000 + 1) / 7);
}

export function saisonDuMois(mois: number): 'printemps' | 'ete' | 'automne' | 'hiver' {
  if (mois >= 2 && mois <= 4) return 'printemps';
  if (mois >= 5 && mois <= 7) return 'ete';
  if (mois >= 8 && mois <= 10) return 'automne';
  return 'hiver';
}
