# MANDAT — images à générer

Prompts en anglais (meilleurs résultats sur Midjourney, DALL·E, Flux, Ideogram…), consignes en français.
Chaque section indique **où déposer le fichier**, son **format** et son **prompt**.

> Les fichiers marqués **✅ branché** sont déjà utilisés par l'app : il suffit de remplacer le fichier.
> Les autres (**🔌 phase 8**) seront branchés quand on codera le profil : déposez-les au bon chemin
> avec le bon nom, le code les chargera par leur identifiant.

---

## 0. Direction artistique commune (à coller en fin de chaque prompt)

```
Style: premium collectible card game art, bold flat vector shapes mixed with fine engraved
guilloché linework like a banknote or passport, subtle paper grain, high contrast.
Palette: deep ink navy #0B0F1A, warm paper #F4F1EA, single accent vermilion #FF5A3C,
with touches of antique gold #C9A227. Clean silhouettes, readable at small size.
No text, no letters, no watermark, no real person's face, no flags, no national or political
party symbols, no religious symbols, no weapons pointed at viewer, no extremist imagery.
```

Règles strictes (stores + brief) :
- **Jamais de visage réaliste d'une personne réelle** (avatars, bannières, logo).
- **Aucun symbole interdit ou extrémiste**, aucun drapeau, aucun logo de parti.
- **Pas de texte dans les images** : l'app affiche tous les textes (traduits FR/EN).

---

## 1. Logo

### 1a. Emblème (le « M » scellé) — sert de base à l'icône
- **Fichier** : `mobile/assets/brand/logo-emblem.png` (master) — 2048×2048, PNG **fond transparent**
- Aussi en vectoriel si l'outil le permet : `mobile/assets/brand/logo-emblem.svg`

```
A bold monogram emblem: a geometric capital letter "M" carved into a round wax-seal / official
stamp medallion, the M made of two stylized ascending columns like a parliament facade, ringed
by fine guilloché rosette engraving, a thin laurel arc at the bottom, centered, symmetrical,
flat vector logo, vermilion #FF5A3C seal with warm paper #F4F1EA engraving lines on transparent
background, crisp edges, works at 32px.
```
*(Ici la lettre « M » est voulue : c'est la seule image où une lettre est autorisée.)*

### 1b. Logotype (mot « MANDAT »)
- **Fichier** : `mobile/assets/brand/logo-wordmark.png` — 2400×600, PNG fond transparent (+ `.svg` idéalement)
- Conseil : génère l'emblème seul, puis compose le mot « MANDAT » toi-même en **Bricolage Grotesque ExtraBold**
  (la police des titres de l'app), lettrage serré, couleur `#F4F1EA` sur fond sombre / `#0B0F1A` sur fond clair.
  Les générateurs d'images déforment souvent les lettres. Si tu veux quand même essayer :

```
Wordmark logo reading exactly "MANDAT", heavy grotesque sans-serif, tight letter spacing,
the A letters subtly shaped like pediments of a classical building, warm paper color on
transparent background, flat vector, no other text.
```

---

## 2. Icône et écran de lancement ✅ branché

| Fichier | Taille | Fond | Notes |
|---|---|---|---|
| `mobile/assets/icon.png` | 1024×1024 | **opaque** (iOS refuse la transparence) | icône iOS |
| `mobile/assets/android-icon-foreground.png` | 1024×1024 | transparent | emblème dans les 66 % centraux (zone de sécurité) |
| `mobile/assets/android-icon-background.png` | 1024×1024 | opaque | fond seul |
| `mobile/assets/android-icon-monochrome.png` | 1024×1024 | transparent | emblème en **blanc uni**, une seule couleur |
| `mobile/assets/splash-icon.png` | 1024×1024 | transparent | affiché à 160 px sur fond `#0B0F1A` |
| `mobile/assets/favicon.png` | 48×48 | transparent | réduction de l'emblème |

Icône iOS :
```
App icon, square, full-bleed: the MANDAT seal emblem (vermilion wax-seal medallion with a
geometric "M" made of two parliament columns, guilloché rosette ring) centered on a deep ink
navy #0B0F1A background with a soft radial glow and faint banknote guilloché pattern,
slight foil sheen like a rare trading card, flat vector, no other text, no rounded corners
(the OS rounds them), high contrast, readable at 60px.
```
Fond Android : `Deep ink navy #0B0F1A background with a soft vermilion radial glow and a faint guilloché banknote pattern, no subject, no text.`

Les autres fichiers se déclinent de l'emblème (1a) : pas besoin de nouveau prompt.

---

## 3. Onboarding (3 écrans) 🔌 phase 10

- **Fichiers** : `mobile/assets/images/onboarding/onboarding-1.png`, `-2.png`, `-3.png`
- **Format** : 1080×1350, PNG fond transparent (posé sur le fond sombre de l'app)

1. Collectionner :
```
A fan of five face-down trading cards bursting out of a torn foil booster pack, cards glowing
with silver, green, blue, violet and gold rims, sparkles, dynamic diagonal composition,
transparent background.
```
2. Apprendre l'histoire :
```
An open antique atlas with a glowing globe rising above it, small floating icons of a quill,
a laurel wreath, a scroll and a ballot box orbiting it, sense of discovery, transparent background.
```
3. Défier ses amis :
```
Two trading cards clashing in mid-air with a bright vermilion spark at the impact point,
chess knight and dove silhouettes in the motion trails, energetic, transparent background.
```

---

## 4. Avatars 🔌 phase 8

- **Dossier** : `mobile/assets/images/avatars/` — nom de fichier = identifiant après `avatar.`
  (ex. `avatar.level_15` → `level_15.png`)
- **Format** : 512×512, PNG, **cercle centré sur fond transparent** (l'app ajoute l'anneau de niveau)
- **Gabarit** (remplace `[SUJET]`) :
```
Circular emblem avatar of [SUJET], stylized symbolic object or animal, no human face, centered,
bold flat vector with fine engraved guilloché details, ink navy and warm paper tones with one
vermilion accent, subtle gold rim, transparent background.
```

| Fichier | [SUJET] | Débloqué par |
|---|---|---|
| `starter_1.png` | an owl of wisdom perched on a closed book | départ (au choix) |
| `starter_2.png` | a quill pen crossing a rolled parchment | départ |
| `starter_3.png` | a small globe on a brass stand | départ |
| `starter_4.png` | a white dove with an olive branch | départ |
| `level_5.png` | a ballot box with a folded ballot | niveau 5 |
| `level_10.png` | a judge's gavel on a sound block | niveau 10 |
| `level_15.png` | a classical column capital | niveau 15 |
| `level_20.png` | a compass rose | niveau 20 |
| `level_25.png` | a chess knight piece | niveau 25 |
| `level_30.png` | a laurel wreath | niveau 30 |
| `level_35.png` | a ship's helm wheel | niveau 35 |
| `level_40.png` | an hourglass | niveau 40 |
| `level_45.png` | a lion statue head, heraldic but not national | niveau 45 |
| `level_50.png` | a lighthouse beam | niveau 50 |
| `level_55.png` | a scale of justice | niveau 55 |
| `level_60.png` | an eagle feather quill and inkwell | niveau 60 |
| `level_65.png` | a sealed diplomatic envelope with wax seal | niveau 65 |
| `level_70.png` | an astrolabe | niveau 70 |
| `level_75.png` | a crowned chess king piece | niveau 75 |
| `level_80.png` | a phoenix rising, stylized | niveau 80 |
| `level_85.png` | a parliament dome | niveau 85 |
| `level_90.png` | an ancient sphinx head, stylized, not a real person | niveau 90 |
| `level_95.png` | a golden key | niveau 95 |
| `level_100.png` | a radiant golden sun disc with guilloché rays | niveau 100 |
| `s1_tier_10.png` | a booster pack with a vermilion seal | pass de saison palier 10 |
| `s1_tier_30.png` | a gilded treaty scroll | pass de saison palier 30 |
| `mythic.png` | a prismatic rainbow crystal laurel, holographic | succès « Mythiques » |

---

## 5. Bannières de profil 🔌 phase 8

- **Dossier** : `mobile/assets/images/banners/` — nom = identifiant après `banner.`
- **Format** : 1500×500, PNG **opaque**, sujet décalé à droite (l'avatar et le pseudo se posent à gauche)
- **Gabarit** :
```
Wide profile banner, 3:1, [SCÈNE], decorative and calm on the left third so text can sit on it,
main motif on the right, ink navy base with vermilion and gold accents, engraved guilloché
texture, no people, no text.
```

| Fichier | [SCÈNE] |
|---|---|
| `default.png` | a soft guilloché banknote pattern with a faint world map |
| `level_10.png` | a marble parliament hall with tall columns |
| `level_20.png` | an antique map of the world with sailing routes |
| `level_30.png` | a night sky over a domed capitol building |
| `level_40.png` | a grand library with endless bookshelves |
| `level_50.png` | a treaty signing table with quills and wax seals (no people) |
| `level_60.png` | ancient ruins of a forum at sunset |
| `level_70.png` | a chessboard landscape stretching to the horizon |
| `level_80.png` | a stormy sea with a lighthouse |
| `level_90.png` | a golden laurel arc over clouds |
| `level_100.png` | a radiant gold and vermilion sunrise over a globe |
| `s1_tier_20.png` | a cascade of booster packs and cards |
| `s1_tier_40.png` | a hall of framed trading cards like a museum |
| `mythic.png` | a holographic prismatic aurora |
| `complete_season_1.png` | all six rarity colors as light rays bursting from a sealed medallion |

---

## 6. Badges de succès 🔌 phase 8

- **Dossier** : `mobile/assets/images/badges/` — un badge **par famille**. L'app colore le niveau
  (bronze, argent, or) et ajoute le chiffre, donc **pas de chiffre dans l'image**.
- **Format** : 512×512, PNG fond transparent, forme de médaille ronde
- **Gabarit** :
```
Round achievement medal badge showing [SYMBOLE], embossed metal medallion with guilloché ring,
neutral silver metal (will be tinted in app), single vermilion enamel accent, flat vector,
transparent background, no text, no numbers.
```

| Fichier | [SYMBOLE] | Succès concernés |
|---|---|---|
| `packs.png` | a torn-open booster pack | boosters ouverts |
| `collection.png` | a stack of trading cards | taille de collection |
| `continent.png` | a globe with one highlighted continent | collection par continent |
| `era.png` | an hourglass with layered sand bands | collection par époque |
| `rarity_rare.png` | a blue gem | raretés |
| `rarity_epic.png` | a violet faceted crystal | raretés |
| `rarity_legendary.png` | a gold crown of laurels | raretés |
| `rarity_mythic.png` | a rainbow prism | raretés |
| `finish_holo.png` | a shimmering holographic card | finitions holo |
| `finish_full_art.png` | a card with art bursting beyond its frame | finitions full art |
| `finish_gold.png` | a solid gold card | finitions or |
| `streak.png` | a flame | séries |
| `level.png` | a rising chevron star | niveaux |
| `quiz.png` | an open book with a question mark shape made of a quill | quiz (le « ? » est un symbole, pas du texte) |
| `quiz_perfect.png` | an open book with a star | quiz parfaits |
| `duel.png` | two crossed cards with a spark | duels gagnés |
| `recycle.png` | a circular arrow of cards | recyclage |
| `craft.png` | an anvil with a glowing card | fabrication |

---

## 7. Illustrations des cartes (optionnel, après la v1)

Depuis le 19/10/2026, 499 cartes affichent la **photo Wikimedia Commons** de la personne (licences et auteurs
dans `data/portraits.manifest.json`, crédits dans l'app ; une seule carte sans photo garde le visuel procédural).
Des illustrations générées peuvent remplacer une photo carte par carte (même nom de fichier dans
`mobile/assets/portraits/<cardId>.webp`, puis `npm run sync:cards`). Les photos sources (`data/portraits/`,
hors git) servent alors de référence.

- **Fichier** : `mobile/assets/portraits/<cardId>.webp` (ex. `s1-042.webp`), 600×800 max, WebP qualité 78 (remplace la photo)
- **Recommandations** :
  - style **illustré** (gravure, affiche, peinture), jamais photo-réaliste ;
  - **ne pas illustrer les cartes `sensitive`** : garder leur visuel procédural sobre (règle du brief) ;
  - vérifier les droits d'usage commercial de ton générateur.
- **Gabarit** (remplace les crochets avec les champs de `data/cards.season1.json`) :
```
Trading card illustration portrait of [NAME], [ROLE], [ERA] era, [COUNTRY] context,
dignified three-quarter pose, engraved banknote / vintage poster illustration style, not
photorealistic, symbolic background evoking their historical moment, no text, no flags,
no party symbols, vertical 63:88 composition with the face in the upper third.
```

---

## 8. Boosters (optionnel)

Les boosters sont dessinés en Skia (procédural). Pour une illustration au centre de la pochette :
- **Fichier** : `mobile/assets/images/packs/<packId>.png` — `s1-standard`, `s1-europe`, `s1-africa`,
  `s1-asia`, `s1-north-america`, `s1-south-america`, `s1-oceania` — 800×800, fond transparent
```
Central emblem illustration for a trading card booster pack themed [THEME], symmetrical
medallion composition, engraved guilloché style, transparent background, no text, no flags.
```
Thèmes : standard = « a world globe wreathed in laurels » ; Europe = « classical columns and a
cathedral rose window » ; Afrique = « baobab tree and savanna sun » ; Asie = « pagoda roofs and a
rising sun disc » ; Amérique du Nord = « mountains, eagle feather and prairie » ; Amérique du Sud =
« Andes peaks and a condor » ; Océanie = « ocean wave, coral and a southern cross of stars ».

---

## Récapitulatif

| Lot | Nombre | Priorité |
|---|---|---|
| Logo (emblème + logotype) | 2 | **v1** |
| Icône, Android, splash, favicon | 6 (déclinés du logo) | **v1** |
| Onboarding | 3 | v1 (phase 10) |
| Avatars | 27 | phase 8 |
| Bannières | 15 | phase 8 |
| Badges | 18 | phase 8 |
| Boosters | 7 | optionnel |
| Illustrations de cartes | jusqu'à 500 (hors `sensitive`) | après la v1 |
