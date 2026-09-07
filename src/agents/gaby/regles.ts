// Catalogue des contrôles automatiques, calqué sur les Standards
// publicitaires Meta. Tout ce qui peut se décider sans modèle est décidé
// ici : c'est gratuit, instantané, et surtout toujours identique d'une
// vérification à l'autre. L'IA ne s'occupe que du reste (le visuel, le
// sens, la page de destination).
//
// Rappel utile pour la suite : ces contrôles anticipent la décision de
// Meta, ils ne la remplacent pas. La revue finale reste celle de Meta.

import type { Gravite, Verticale } from './types';

export interface ChampsAnnonce {
  texte_principal: string;
  titre: string | null;
  description: string | null;
  cta: string | null;
  url_destination: string | null;
  /** Pour une vidéo : ce qui est dit et sous-titré. Analysé comme du texte. */
  transcription?: string | null;
}

export type Champ = keyof ChampsAnnonce;

export interface Constat {
  regle_id: string;
  gravite: Gravite;
  politique: string;
  extrait: string | null;
  pourquoi: string;
  correction: string;
}

interface Regle {
  id: string;
  /** Nom de la règle Meta, tel qu'il sort dans les notifications de refus. */
  politique: string;
  gravite: Gravite;
  /** null = toutes les verticales. */
  verticales: Verticale[] | null;
  champs: Champ[];
  motif: RegExp;
  pourquoi: string;
  correction: string;
}

const TOUS_TEXTES: Champ[] = ['texte_principal', 'titre', 'description', 'transcription'];

// ------------------------------------------------------------ catalogue

export const REGLES: Regle[] = [
  // --- Attributs personnels : le motif de refus n°1 en acquisition -------
  {
    id: 'ATTR-01',
    politique: 'Attributs personnels',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:vous|tu)\s+(?:êtes|es|avez|as)\s+(?:en\s+surpoids|obèse|diabétique|dépressi(?:f|ve)|anxieux|endetté(?:e)?|au\s+chômage|divorcé(?:e)?|célibataire|handicapé(?:e)?|séropositi(?:f|ve)|alcoolique)\b/i,
    pourquoi:
      "La pub affirme connaître un état de santé ou une situation personnelle du lecteur. Meta l'interdit, même quand c'est le cœur du message.",
    correction:
      "Passer du « vous » au général : « Vous êtes diabétique ? » devient « Vivre avec le diabète, autrement ». Le ciblage fait le reste.",
  },
  {
    id: 'ATTR-02',
    politique: 'Attributs personnels',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:votre|ton|ta|tes|vos)\s+(?:diabète|dépression|surpoids|obésité|cancer|calvitie|acné|anxiété|dette(?:s)?|divorce|handicap|infertilité|ménopause|addiction)\b/i,
    pourquoi:
      "Le possessif attribue la condition au lecteur. Même logique que ci-dessus : Meta lit ça comme une affirmation sur la personne.",
    correction:
      "Retirer le possessif et parler du sujet, pas de la personne : « votre acné » devient « l'acné hormonale ».",
  },
  {
    id: 'ATTR-03',
    politique: 'Attributs personnels',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:si\s+vous\s+avez\s+plus\s+de\s+\d{2}\s+ans|(?:femmes|hommes|mamans|papas)\s+de\s+(?:plus\s+de\s+)?\d{2}\s*ans)\b/i,
    pourquoi:
      "Interpeller par l'âge ou le genre revient à désigner le lecteur. Toléré parfois, refusé souvent — ça dépend du reviewer.",
    correction:
      "Déplacer le critère dans le ciblage de l'ensemble de pubs et retirer la mention du texte.",
  },
  {
    id: 'ATTR-04',
    politique: 'Attributs personnels',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:vous|tu)\s+(?:êtes|es)\s+(?:musulman|chrétien|juif|catholique|athée|gay|lesbienne|homosexuel|trans)(?:e|ne)?s?\b/i,
    pourquoi:
      'Religion et orientation sexuelle sont des attributs protégés. Refus quasi systématique, et souvent un avertissement sur le compte.',
    correction: 'Supprimer la mention. Rien ne remplace cette formulation : il faut réécrire l\'accroche.',
  },

  // --- Promesses de gains -----------------------------------------------
  {
    id: 'FIN-01',
    politique: 'Produits ou services financiers trompeurs',
    gravite: 'bloquant',
    verticales: ['crypto', 'finance', 'formation'],
    champs: TOUS_TEXTES,
    motif: /\b(?:gains?|revenus?|rendements?|profits?|bénéfices?)\s+(?:garantis?|assurés?|certains?|sans\s+risque)\b/i,
    pourquoi:
      "Meta interdit toute promesse de rendement garanti. C'est le déclencheur le plus rapide vers la restriction de compte publicitaire.",
    correction:
      "Remplacer la garantie par un fait vérifiable : « rendement garanti » devient « rendement moyen constaté sur 2024, capital non garanti ».",
  },
  {
    id: 'FIN-02',
    politique: 'Produits ou services financiers trompeurs',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\d[\d\s.,]*\s*(?:€|euros?|k€)\s*(?:\/|par\s+)(?:jour|semaine|mois)\b/i,
    pourquoi:
      "Un montant de gain rattaché à une durée est lu comme une promesse de revenu. Interdit hors offre d'emploi déclarée.",
    correction:
      "Sortir le chiffre de l'accroche ou l'attribuer explicitement : « ce que Julie a facturé son 3ᵉ mois » plutôt que « 3 000 €/mois ».",
  },
  {
    id: 'FIN-03',
    politique: 'Pratiques commerciales inacceptables',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:devenir\s+riche|argent\s+facile|revenus?\s+passifs?\s+garantis?|sans\s+aucun\s+effort|100\s*%\s*(?:de\s+)?(?:réussite|gagnant|rentable)|enrichissez[- ]vous)\b/i,
    pourquoi:
      "Schéma « enrichissement rapide ». Meta le classe dans les pratiques commerciales inacceptables, au même niveau que l'arnaque.",
    correction:
      "Décrire la méthode et le temps que ça prend. Le concret passe, la promesse d'abondance non.",
  },
  {
    id: 'FIN-04',
    politique: 'Produits ou services financiers trompeurs',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:doubl(?:er|ez)|tripl(?:er|ez)|x\s*\d+)\s+(?:votre|ton|son)\s+(?:capital|argent|investissement|mise)\b/i,
    pourquoi: 'Promesse de multiplication du capital : refus, et signal fort pour les contrôles de compte.',
    correction: 'Retirer le multiplicateur. Parler du produit, pas du résultat espéré.',
  },
  {
    id: 'FIN-05',
    politique: 'Cryptomonnaies',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:crypto(?:monnaies?)?|bitcoin|btc|ethereum|eth|token|nft|web3|airdrop|staking|memecoin)\b/i,
    pourquoi:
      "Les pubs crypto exigent une autorisation écrite Meta rattachée au compte. Sans elle, la pub tombe quel qu'en soit le texte.",
    correction:
      "Vérifier que l'autorisation crypto du compte est active et non expirée avant diffusion. Si elle manque, la demande passe avant tout le reste.",
  },
  {
    id: 'FIN-06',
    politique: 'Prêts personnels / Catégorie spéciale Crédit',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:prêt\s+(?:personnel|immobilier|rapide)|rachat\s+de\s+crédits?|micro-?crédit|crédit\s+à\s+la\s+consommation|taux\s+d'?intérêt)\b/i,
    pourquoi:
      "Le crédit déclenche la catégorie spéciale « Crédit » (ciblage restreint) et impose d'afficher les conditions, dont le TAEG.",
    correction:
      "Cocher la catégorie spéciale Crédit dans l'ensemble de pubs et faire figurer TAEG, durée et coût total sur la page de destination.",
  },
  {
    id: 'FIN-07',
    politique: 'Produits ou services financiers trompeurs',
    gravite: 'avertissement',
    verticales: ['crypto', 'finance'],
    champs: TOUS_TEXTES,
    motif: /\b(?:invest(?:ir|issement)|placement|trading|portefeuille|bourse)\b/i,
    pourquoi:
      "Une pub d'investissement sans mention de risque est fragile : le reviewer cherche l'équilibre entre le gain annoncé et le risque rappelé.",
    correction:
      "Ajouter une ligne de mention : « Investir comporte un risque de perte en capital. » Une phrase suffit, mais elle doit être là.",
  },

  // --- Santé, corps, apparence ------------------------------------------
  {
    id: 'SANTE-01',
    politique: 'Santé et apparence physique',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\bavant\s*(?:\/|et|-)\s*après\b/i,
    pourquoi:
      'Les comparaisons avant / après sont interdites pour tout ce qui touche au corps, au texte comme à l\'image.',
    correction:
      "Garder une seule image, la situation d'usage. Le résultat se raconte, il ne se montre pas en diptyque.",
  },
  {
    id: 'SANTE-02',
    politique: 'Santé et apparence physique',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:perd(?:re|ez)|éliminez?|brûlez?)\s+(?:jusqu'à\s+)?\d+\s*(?:kg|kilos?|cm|centimètres?|tailles?)\b/i,
    pourquoi: "Résultat corporel chiffré : Meta le traite comme une attente irréaliste. Refus systématique.",
    correction:
      "Retirer le chiffre et le délai. « Perdez 10 kg en 30 jours » devient « Un programme de rééquilibrage sur 12 semaines ».",
  },
  {
    id: 'SANTE-03',
    politique: 'Allégations de santé trompeuses',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:guéri(?:t|r|son)|soigne\s+(?:le|la|les)|remède\s+(?:naturel|miracle)|solution\s+miracle|effet\s+immédiat\s+garanti)\b/i,
    pourquoi:
      "Allégation thérapeutique. Un complément ou un cosmétique ne peut pas prétendre guérir ou soigner.",
    correction:
      "Passer au vocabulaire du confort et de l'accompagnement : « aide à », « contribue à », « pensé pour ».",
  },

  // --- Pratiques trompeuses ---------------------------------------------
  {
    id: 'TROMP-01',
    politique: 'Fonctionnalités trompeuses',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /(?:cliquez\s+(?:ici|sur)\s*(?:▶|►|⬇|👇|👆|⬆)|appuyez\s+sur\s+(?:le\s+)?bouton\s+(?:lecture|play))/i,
    pourquoi:
      "Le texte renvoie à un faux élément d'interface. Meta refuse tout ce qui imite un bouton, une croix ou une notification.",
    correction: "Supprimer la flèche et l'injonction. Le bouton d'appel à l'action de la pub fait ce travail.",
  },
  {
    id: 'TROMP-02',
    politique: 'Pratiques commerciales inacceptables',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:il\s+ne\s+reste\s+que\s+\d+|plus\s+que\s+\d+\s+places?|stock\s+(?:presque\s+)?épuisé|derni(?:ère|ères|er|ers)\s+(?:heures?|places?|chances?))\b/i,
    pourquoi:
      "Rareté chiffrée. Autorisée si elle est vraie et vérifiable ; refusée si le compteur repart à zéro chaque jour.",
    correction:
      "Garder l'urgence seulement si elle correspond à une date de fin réelle, affichée sur la page de destination.",
  },
  {
    id: 'TROMP-03',
    politique: 'Pratiques commerciales inacceptables',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:j'?ai\s+gagné\s+\d|il\s+a\s+gagné\s+\d|elle\s+a\s+gagné\s+\d|témoignage\s+(?:réel|vérifié)|résultats?\s+typiques?)\b/i,
    pourquoi:
      "Témoignage de gain. Meta considère qu'il crée une attente que l'annonceur ne peut pas tenir pour tout le monde.",
    correction:
      "Anonymiser le montant ou le remplacer par le déroulé : ce que la personne a fait, pas ce qu'elle a encaissé.",
  },
  {
    id: 'TROMP-04',
    politique: 'Pratiques commerciales inacceptables',
    gravite: 'avertissement',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:100\s*%\s*gratuit|totalement\s+gratuit|entièrement\s+offert|sans\s+aucun\s+frais)\b/i,
    pourquoi:
      "La gratuité annoncée doit se vérifier dès l'arrivée sur la page. Si un paiement apparaît à l'étape suivante, c'est trompeur.",
    correction:
      "Préciser ce qui est gratuit : « le premier module est gratuit » plutôt que « 100 % gratuit ».",
  },

  // --- Contenus interdits -----------------------------------------------
  {
    id: 'INT-01',
    politique: 'Tabac, vapotage et produits associés',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:cigarette(?:s)?\s+électroniques?|vapotage|e-?liquide|puff|nicotine|tabac|chicha|narguilé)\b/i,
    pourquoi: 'Catégorie interdite sans exception sur Meta, y compris pour les produits de sevrage vendus en ligne.',
    correction: "Cette pub ne passera pas en l'état. Le produit doit sortir de la campagne.",
  },
  {
    id: 'INT-02',
    politique: 'Drogues et produits associés',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:cbd|cannabis|thc|chanvre\s+récréatif|kratom|poppers|stéroïdes?|anabolisants?|sarms)\b/i,
    pourquoi: 'Produits interdits à la publicité, même là où ils sont légaux à la vente.',
    correction: 'Retirer le produit de la campagne. Aucun réglage de ciblage ne débloque cette catégorie.',
  },
  {
    id: 'INT-03',
    politique: 'Armes, munitions ou explosifs',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:armes?\s+à\s+feu|munitions?|pistolet|taser|matraque|couteau\s+de\s+combat)\b/i,
    pourquoi: 'Catégorie interdite.',
    correction: 'Retirer le produit de la campagne.',
  },
  {
    id: 'INT-04',
    politique: 'Contrefaçon et droits de propriété intellectuelle',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:réplique|dupe|copie\s+(?:de\s+luxe|conforme)|inspiré\s+de\s+(?:Rolex|Chanel|Dior|Nike|Louis\s+Vuitton))\b/i,
    pourquoi: "Vente de contrefaçon. Au-delà du refus, la Page peut être signalée par l'ayant droit.",
    correction: 'Retirer toute référence à la marque copiée et vendre le produit pour ce qu\'il est.',
  },

  // --- Marques et mentions -----------------------------------------------
  {
    id: 'MARQ-01',
    politique: 'Utilisation des marques Meta',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:FaceBook|face\s?book|Instagram\s*™|Meta\s*®|partenaire\s+officiel\s+(?:de\s+)?(?:Facebook|Meta|Instagram))\b/,
    pourquoi:
      "Meta encadre l'usage de ses noms : orthographe exacte, pas de logo modifié, et surtout aucune suggestion de partenariat.",
    correction:
      "Écrire « Facebook » et « Instagram » correctement, et supprimer toute idée d'affiliation avec Meta.",
  },

  // --- Catégories spéciales ----------------------------------------------
  {
    id: 'SPEC-01',
    politique: 'Catégorie spéciale : Emploi',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:offre\s+d'?emploi|nous\s+recrutons|poste\s+à\s+pourvoir|CDI|CDD|alternance|rejoignez\s+notre\s+équipe)\b/i,
    pourquoi:
      "Une annonce d'emploi doit être déclarée en catégorie spéciale, ce qui restreint le ciblage (âge, genre, rayon minimum).",
    correction: "Déclarer la catégorie spéciale Emploi au niveau de la campagne, puis retirer les critères de ciblage interdits.",
  },
  {
    id: 'SPEC-02',
    politique: 'Catégorie spéciale : Logement',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:appartement\s+à\s+(?:louer|vendre)|bien\s+immobilier|programme\s+neuf|investissement\s+locatif|LMNP|Pinel)\b/i,
    pourquoi: 'Le logement est une catégorie spéciale : ciblage restreint, sous peine de refus rétroactif.',
    correction: 'Déclarer la catégorie spéciale Logement sur la campagne avant de relancer.',
  },
  {
    id: 'SPEC-03',
    politique: 'Publicités à caractère politique ou social',
    gravite: 'risque',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:élection|candidat(?:e)?\s+aux|parti\s+politique|pétition|référendum|réforme\s+des\s+retraites)\b/i,
    pourquoi:
      "Sujets sociaux et politiques : autorisation préalable, vérification d'identité et clause « Financé par » obligatoires.",
    correction:
      "Faire vérifier l'identité de l'annonceur et activer la clause de financement, ou retirer l'angle politique du message.",
  },

  // --- Données sensibles --------------------------------------------------
  {
    id: 'DATA-01',
    politique: 'Collecte de données sensibles',
    gravite: 'bloquant',
    verticales: null,
    champs: TOUS_TEXTES,
    motif: /\b(?:numéro\s+de\s+(?:carte|sécurité\s+sociale)|RIB|IBAN|carte\s+bancaire\s+demandée)\b/i,
    pourquoi: 'Une pub ne peut pas solliciter de données financières ou administratives sensibles.',
    correction: 'Retirer la demande du texte et la déplacer dans un parcours sécurisé après le clic.',
  },
];

// ------------------------------------------------- contrôles non textuels

const RACCOURCISSEURS = /\b(?:bit\.ly|tinyurl\.com|cutt\.ly|t\.co|rb\.gy|is\.gd|lnkd\.in|shorturl\.at)\b/i;
const UNICODE_STYLISE = /[\u{1D400}-\u{1D7FF}\u{FF21}-\u{FF3A}]/u;

function tauxMajuscules(texte: string): number {
  const lettres = texte.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (lettres.length < 20) return 0;
  const majuscules = lettres.replace(/[^A-ZÀ-Þ]/g, '').length;
  return majuscules / lettres.length;
}

function compterEmojis(texte: string): number {
  return (texte.match(/\p{Extended_Pictographic}/gu) ?? []).length;
}

function extraitAutour(texte: string, index: number, longueur: number): string {
  const debut = Math.max(0, index - 25);
  const fin = Math.min(texte.length, index + longueur + 25);
  return `${debut > 0 ? '…' : ''}${texte.slice(debut, fin).trim()}${fin < texte.length ? '…' : ''}`;
}

// --------------------------------------------------------------- moteur

/** Passe les champs de l'annonce dans tout le catalogue. */
export function controler(champs: ChampsAnnonce, verticale: Verticale): Constat[] {
  const constats: Constat[] = [];
  const vus = new Set<string>();

  for (const regle of REGLES) {
    if (regle.verticales && !regle.verticales.includes(verticale)) continue;
    for (const champ of regle.champs) {
      const valeur = champs[champ];
      if (!valeur) continue;
      const trouve = regle.motif.exec(valeur);
      if (!trouve) continue;
      if (vus.has(regle.id)) break;
      vus.add(regle.id);
      constats.push({
        regle_id: regle.id,
        gravite: regle.gravite,
        politique: regle.politique,
        extrait: extraitAutour(valeur, trouve.index, trouve[0].length),
        pourquoi: regle.pourquoi,
        correction: regle.correction,
      });
      break;
    }
  }

  // --- forme du texte ---
  const texteEntier = [champs.texte_principal, champs.titre, champs.description].filter(Boolean).join(' ');

  if (tauxMajuscules(texteEntier) > 0.35) {
    constats.push({
      regle_id: 'FORM-01',
      gravite: 'avertissement',
      politique: 'Grammaire et ponctuation',
      extrait: null,
      pourquoi: "Plus d'un tiers du texte est en majuscules. Meta traite ça comme du texte criard et peut refuser.",
      correction: "Réserver les majuscules à un ou deux mots, pas à des phrases entières.",
    });
  }

  if (/[!?]{3,}|\.{4,}/.test(texteEntier)) {
    constats.push({
      regle_id: 'FORM-02',
      gravite: 'avertissement',
      politique: 'Grammaire et ponctuation',
      extrait: null,
      pourquoi: 'Ponctuation répétée. Motif classique de refus pour « ponctuation excessive ».',
      correction: 'Un seul point d\'exclamation par phrase.',
    });
  }

  if (compterEmojis(texteEntier) > 8) {
    constats.push({
      regle_id: 'FORM-03',
      gravite: 'avertissement',
      politique: 'Grammaire et ponctuation',
      extrait: null,
      pourquoi: `${compterEmojis(texteEntier)} emojis dans le texte. Au-delà d'une poignée, la pub est lue comme du spam.`,
      correction: 'En garder deux ou trois, au maximum, et jamais en remplacement d\'un mot.',
    });
  }

  if (UNICODE_STYLISE.test(texteEntier)) {
    constats.push({
      regle_id: 'FORM-04',
      gravite: 'risque',
      politique: 'Contournement des systèmes',
      extrait: null,
      pourquoi:
        "Le texte contient des caractères Unicode stylisés (gras, italique décoratif). Meta les lit comme une tentative de contourner la détection automatique.",
      correction: 'Réécrire en caractères normaux et obtenir le style par la mise en forme du visuel.',
    });
  }

  if (champs.texte_principal.length > 600) {
    constats.push({
      regle_id: 'FORM-05',
      gravite: 'avertissement',
      politique: 'Qualité de la publicité',
      extrait: null,
      pourquoi: `Texte principal de ${champs.texte_principal.length} caractères : il sera tronqué bien avant la fin sur mobile.`,
      correction: "Faire tenir l'argument principal dans les 125 premiers caractères.",
    });
  }

  if (champs.titre && champs.titre.length > 40) {
    constats.push({
      regle_id: 'FORM-06',
      gravite: 'avertissement',
      politique: 'Qualité de la publicité',
      extrait: champs.titre,
      pourquoi: `Titre de ${champs.titre.length} caractères : coupé au-delà de 40 dans la plupart des placements.`,
      correction: 'Raccourcir à 40 caractères ou moins.',
    });
  }

  // --- page de destination ---
  const url = champs.url_destination;
  if (!url || !url.trim()) {
    constats.push({
      regle_id: 'DEST-01',
      gravite: 'risque',
      politique: 'Qualité de la page de destination',
      extrait: null,
      pourquoi: "Aucune URL de destination fournie : impossible de vérifier la cohérence entre la promesse et la page.",
      correction: 'Demander le lien exact au client, paramètres UTM compris.',
    });
  } else {
    if (RACCOURCISSEURS.test(url)) {
      constats.push({
        regle_id: 'DEST-02',
        gravite: 'bloquant',
        politique: 'Contournement des systèmes',
        extrait: url,
        pourquoi:
          "Lien raccourci. Meta ne peut pas contrôler la destination réelle et classe ça comme contournement du système de revue.",
        correction: "Mettre l'URL finale en clair. Les paramètres de suivi peuvent rester.",
      });
    }
    if (/^http:\/\//i.test(url.trim())) {
      constats.push({
        regle_id: 'DEST-03',
        gravite: 'avertissement',
        politique: 'Qualité de la page de destination',
        extrait: url,
        pourquoi: 'Page en HTTP non sécurisé : mauvaise expérience signalée et perte de conversions au passage.',
        correction: 'Basculer la page en HTTPS.',
      });
    }
  }

  return constats;
}

// ------------------------------------------------------------- notation

const POIDS: Record<Gravite, number> = { bloquant: 45, risque: 20, avertissement: 6 };

/** Score de risque 0–100, à partir des points retenus. */
export function calculerRisque(constats: { gravite: Gravite }[]): number {
  const total = constats.reduce((somme, c) => somme + POIDS[c.gravite], 0);
  return Math.min(100, total);
}

/** Le verdict découle des points : un bloquant suffit. */
export function deduireVerdict(constats: { gravite: Gravite }[]): 'conforme' | 'a_corriger' | 'refus_probable' {
  if (constats.some((c) => c.gravite === 'bloquant')) return 'refus_probable';
  if (constats.some((c) => c.gravite === 'risque')) return 'a_corriger';
  return 'conforme';
}
