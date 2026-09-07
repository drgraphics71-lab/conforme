# Conforme

Vérification des publicités Meta avant diffusion, pour agences et
indépendants qui valident les créations de leurs clients.

Le nom du produit est une constante unique, `src/lib/marque.ts`. Le
renommer se fait là, nulle part ailleurs.

## Ce qu'il y a dedans

Un socle multi-comptes : un utilisateur, un ou plusieurs **espaces**, un
abonnement par espace. Un espace regroupe ses clients, ses lots de
publicités et ses règles maison. C'est ce qui permettra de vendre le
produit à plusieurs agences sans rien recloisonner ensuite.

Deux agents. **Gaby** s'occupe de l'avant : vérifier les pubs avant
diffusion. **Nina** s'occupe de l'après : traiter les refus déjà tombés.

## Mise en route

1. **Projet Supabase.** Créez-en un neuf, puis récupérez son URL et sa clé
   anon dans Settings → API. Copiez `.env.example` en `.env` et remplissez
   les deux lignes.

2. **Base.** Dans le SQL Editor, exécutez `001_socle.sql`, `002_gaby.sql`
   puis `004_nina.sql`, dans cet ordre. Le premier crée espaces, membres,
   abonnements et la fonction `creer_espace`. Le second crée les tables de
   Gaby et le bucket privé `pubs`.

3. **Authentification.** Dans Authentication → Providers → Email, désactivez
   « Confirm email » le temps des essais : sinon chaque inscription attend un
   mail de confirmation. À réactiver avant d'ouvrir le produit à des clients.

4. **Application.** `npm install` puis `npm run dev`. Vous créez votre compte
   depuis l'écran d'accueil, puis votre espace, et vous arrivez sur Gaby.

5. **Analyse.** Le bouton « Vérifier le lot » a besoin de la fonction :
   ```
   supabase functions deploy gaby
   supabase functions deploy nina
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase secrets set TRANSCRIPTION_API_KEY=...   # facultatif
   ```
   Tout le reste — dépôt des pubs, contrôles automatiques, découpage des
   vidéos — tourne sans elle.

## Comment travaille Gaby

Un **lot** = un envoi client. Il contient des **annonces** : un texte, un
visuel ou une vidéo, une page de destination.

La vérification se fait en deux temps. D'abord les **contrôles
automatiques**, dès l'ajout, dans le navigateur, sans appel payant :
attributs personnels, promesses de gains, allégations de santé, catégories
spéciales, forme du texte, liens raccourcis. Le catalogue est dans
`src/agents/gaby/regles.ts`, c'est là qu'on ajoute une règle.

Ensuite l'**analyse du lot**, à la demande : la fonction envoie chaque
annonce à Claude avec ses visuels et cherche ce qu'aucune expression
régulière n'attrape — avant/après en image, faux bouton de lecture,
promesse implicite, écart entre le message et la page de destination.

Chaque point porte la règle Meta concernée, pourquoi ça bloque, et la
correction à appliquer. Un point peut être **écarté** d'un clic ; le verdict
se recalcule sans lui.

Puis « Rédiger la réponse » produit le message à envoyer, à partir des seuls
points retenus.

### Les vidéos

Tout le découpage se fait dans le navigateur (`video.ts`) : une image toutes
les 2,5 secondes, une rafale seconde par seconde sur les cinq dernières —
c'est là qu'est la carte de fin, donc l'offre et la capture de la page de
destination — et la piste audio en WAV 16 kHz mono, environ 2 Mo par minute.

Les noms de fichiers sont lus au passage : `Copie_de_2057_1_VD_UGC.mp4`
donne la référence `2057-1`. Les fichiers qui partagent le même numéro de
concept sont des variantes d'une même pub.

À l'analyse, l'audio est transcrit, puis transcription et images horodatées
partent au modèle. Les contrôles automatiques repassent ensuite sur la
transcription : dans une vidéo, le texte à vérifier est dans les sous-titres
et la voix, pas dans le champ « texte principal ».

Sans `TRANSCRIPTION_API_KEY`, l'analyse se rabat sur la lecture des
sous-titres incrustés. Suffisant quand les pubs sont sous-titrées, insuffisant
sur une voix off nue.

## Sur le ton des réponses

La consigne de rédaction, dans `supabase/functions/gaby/index.ts`, interdit
explicitement ce qui trahit un texte généré : emojis, titres en gras,
« Points positifs / Points à améliorer », « n'hésitez pas à revenir vers
moi », « il est important de noter ». Phrases courtes, une idée par phrase,
la correction en clair.

Deux réglages par lot, court/détaillé et direct/cordial. Le tutoiement et la
signature se règlent par client. Si un retour sonne trop lisse, c'est cette
consigne qu'il faut resserrer, pas le code autour.

## Comment travaille Nina

On crée un **refus**, on y dépose les captures de la notification Meta —
le bandeau du gestionnaire de publicités, le mail, l'écran de la Page — et
on lance le diagnostic.

Nina lit la capture et en tire le motif exact affiché, la règle citée, et
ce qui est touché : une annonce, un compte, une Page, un catalogue. Cette
distinction compte : une restriction de compte se traite avant tout le
reste.

Puis elle remonte du motif affiché à la cause réelle. C'est là qu'est la
valeur : Meta affiche des motifs génériques, et « Pratiques commerciales
inacceptables » peut venir de trois choses très différentes. Quand la pub
est rattachée à une annonce déjà vérifiée par Gaby, Nina l'a sous les yeux
et tranche ; sinon elle donne les causes les plus probables et ce qu'il
faut vérifier.

Elle envisage explicitement le faux positif, fréquent sur les comptes
récents, et recommande une stratégie : corriger, contester, faire les deux,
ou renoncer. Elle réécrit le texte en gardant l'angle marketing, et rédige
la demande de révision — courte, factuelle, sans les arguments qui ne
pèsent jamais (budget dépensé, ancienneté du compte, les autres font pire).

### La boucle d'apprentissage

Le champ « ce qui a débloqué » est le plus important de l'écran. Une fois
la pub repassée, on note ce qui a marché. Ces résolutions sont réinjectées
dans les diagnostics suivants du même client, et le bouton « Ajouter aux
règles maison » verse le motif dans `pub_regles_maison`, que Gaby applique
ensuite à toutes les vérifications.

C'est ce qui fait qu'au bout de quelques mois l'outil connaît mieux les
refus de vos clients que n'importe quelle règle générale.

## Ce qui n'est pas fait

- L'écran de gestion des règles maison (la table `pub_regles_maison` existe
  et est déjà lue par la fonction).
- La facturation. Les tables `abonnements` et les quotas existent, rien ne
  les décrémente ni ne les fait payer.
- La vitrine publique et les pages légales.
- L'import depuis Google Drive : les fichiers se déposent à la main.
- L'écran de gestion des règles maison : elles s'ajoutent depuis Nina, mais
  ne se relisent ni ne se modifient nulle part.

Un point à garder en tête, et à dire aux clients : ce contrôle anticipe la
décision de Meta, il ne la remplace pas.
