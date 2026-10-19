# MANDAT — Stratégie commerciale (v1.1 → v2)

Version du 2026-10-19. Ce document sert à prendre des décisions : modèle économique, grille de prix, conformité,
rétention, mesure, paiements. Les chiffres de marché viennent des sources numérotées en fin de document [n].
Les chiffres d'économie interne viennent de `scripts/economy/simulate.py` (section 3). Il n'est pas un avis juridique.
Les points marqués ⚖️ doivent passer par un avocat (droit des jeux, consommation, droit à l'image) avant
d'activer les paiements.

---

## 0. Décisions à valider

| # | Décision | Recommandation |
|---|---|---|
| D1 | **Offre principale** | Un seul abonnement, **Mandat Premium**, à **4,99 €/mois** ou **39,99 €/an** (−33 %), essai gratuit de 7 jours sur l'annuel uniquement. Le passe de saison Premium est **inclus** et ne se vend pas à part en v1. |
| D2 | **« +2 boosters/jour »** | Une **seconde jauge**, la « Réserve Premium » : +1 booster toutes les 12 h, stock max 2, à côté de la jauge gratuite (12 h, stock 2) qui ne change pas. Au total : 4 boosters/jour, et un joueur qui ne passe qu'une fois par jour les récupère tous. |
| D3 | **Vente de boosters** | **Ne pas vendre de boosters**, ni en euros ni en monnaie premium. On ne vend que des choses non aléatoires : abonnement, cosmétiques, confort. Ça nous laisse hors du champ « loot box payante » presque partout, et c'est un argument marketing. |
| D4 | **Monnaie premium** | Une seule monnaie achetable, les **Sceaux**, qui ne sert qu'aux cosmétiques. Le prix en € est toujours affiché à côté. L'Influence reste gagnée en jeu, jamais achetable. |
| D5 | **Belgique et Pays-Bas** | Ouvrir l'app, mais **dans ces vitrines, la Réserve Premium donne de l'Influence et un craft gratuit au lieu de boosters** (aucun objet aléatoire lié à un paiement). Le pays se lit dans la vitrine App Store, pas dans l'IP. Les cotes restent affichées partout. |
| D6 | **Pubs récompensées** | **Non** en v1/v1.2. Mauvais fit pour la marque (figures politiques à côté de pubs arbitraires), consentement RGPD/ATT, revenus faibles à notre volume. On réévaluera en v2 pour l'Afrique francophone seulement. |
| D7 | **Réglage de l'économie** | **Craft : appliqué le 19/10/2026** (§3.5) : « 10 doublons = 1 carte », quota de **1 craft toutes les 48 h** (stock 3), plafonds **3 quiz et 5 victoires en duel récompensés par jour**, autres sources réduites. Résultat : ~0,5 craft/j pour tous les profils, set complet en ~9 mois (F2P assidu) et ~4,3 mois (Premium assidu). **Reste à décider** : saisons de 14 semaines et passe à 400 XP/palier (scénario `tuned`, le passe se finit aujourd'hui en 21 jours). |
| D8 | **Paiements** | **RevenueCat** (`react-native-purchases`), avec webhooks vers l'API Spring et une table `entitlements` côté serveur, qui reste la source de vérité. Gratuit jusqu'à 2 500 $/mois de revenu suivi, puis 1 %. |
| D9 | **Échanges entre amis** | Oui en v1.2, mais **seulement entre amis** depuis au moins 7 jours, rareté égale, jusqu'à épique, avec un coût en Influence. Aucun lien avec l'argent : on reste hors du régime JONUM et on limite le farming. |
| D10 | **Marketing payant** | Pas de pubs Meta ou Google montrant des personnalités politiques réelles. Ces plateformes ont arrêté les pubs politiques dans l'UE (règlement TTPA, oct. 2025), donc on risque le rejet. Les visuels de campagne montrent le jeu, des figures historiques non controversées, ou les cartes floutées. |

---

## 1. Benchmarks

### 1.1 Pokémon TCG Pocket (DeNA / Creatures, oct. 2024)

C'est la référence directe : un booster ouvert à la main, deux jauges, collection d'abord, le combat en second.

| Élément | Fonctionnement | Leçon pour MANDAT |
|---|---|---|
| **Boosters gratuits** | 2 boosters/jour avec une jauge de stamina. | C'est notre mécanique actuelle (12 h, stock 2). Elle est validée par le marché. |
| **Premium Pass** | **9,99 $/30 jours**, résiliable. Une **seconde jauge** donne **+1 booster/24 h** (~30 boosters/mois). Missions Premium : carte promo, Premium Tickets pour des accessoires, sabliers. Essai gratuit 2 semaines au lancement [3][4][5]. | Notre « +2/jour » donne **deux fois plus** que Pocket (+1/jour) à la moitié du prix. C'est un argument fort, à condition que l'économie suive (section 3). |
| **Pack Hourglasses** | Les sabliers réduisent l'attente de la jauge. Ils s'obtiennent en jeu ou s'achètent indirectement avec la Poké Gold. | C'est le vrai levier de dépense, et c'est un objet aléatoire payant. **À ne pas copier** (D3). |
| **Poké Gold** | Monnaie premium, convertible en sabliers donc en boosters. | C'est ce qui rend le jeu « loot box payante ». Pocket **n'est pas disponible en Belgique** [17], et Pokémon UNITE a quitté la Belgique et les Pays-Bas le 30/11/2025 [17]. |
| **Wonder Pick** | On choisit une carte à l'aveugle parmi les 5 d'un booster ouvert par un autre joueur. Coûte de l'énergie gratuite, parfois des sabliers. | C'est un excellent moteur de sessions et de social. Version MANDAT : « Pioche diplomatique » (section 5.6). |
| **Pack Points** | Chaque booster donne 5 points, propres au set. On les échange contre une carte précise (35 à 2 500 points) [13]. | C'est l'équivalent de notre Influence → craft. Les joueurs se plaignent que les points soient liés à un set : **notre Influence reste universelle**. |
| **Échanges** | Lancés le 28/01/2025 avec des Trade Tokens qu'il fallait obtenir en détruisant 5 cartes. Gros rejet des joueurs, puis refonte (shinedust) [6]. | Les règles anti-bot ont rendu la fonction impopulaire. Il faut un garde-fou anti-fraude qui ne punisse pas les joueurs honnêtes (D9). |
| **Revenus** | ~200 M$ le 1er mois, 400 M$ en 10 semaines, **> 1,2 Md$ la 1ère année** (Sensor Tower) [1][2][13]. En 2026 : chiffre d'affaires jeux de DeNA **−33,2 %** sur un an au T2, **MAU 39 M → 23 M** [13]. | Le modèle « collection + jauges » monétise très fort mais s'essouffle sans renouvellement de contenu ni boucle sociale. Il faut une **cadence d'événements** et des **raisons de revenir** qui ne soient pas que du FOMO. |

Ce que les joueurs reprochent [14] : une analyse virale estimait **~1 843 jours en F2P** pour finir un set sans
Wonder Pick (1 229 jours avec Premium). Les reproches visent aussi le « cash grab » des sabliers et le FOMO des
événements qui se répètent. Ce qu'ils apprécient : le rituel d'ouverture, la beauté des cartes, des sessions de
2 minutes, et la possibilité de jouer sans payer.

### 1.2 Marvel Snap (Second Dinner / Nuverse)

- Passe de saison **9,99 $**, Premium+ **14,99 $** (+10 paliers), puis un palier « Super » à **19,99 $** avec des cosmétiques en 2025 [7].
- Revenus mobiles : **173 M$ la 1ère année, ~103 M$ la 2e (−40 %)**, 276,5 M$ cumulés à 2 ans (AppMagic) [8].
- Leçon : les cartes de saison exclusives au passe, puissantes, ont valu au jeu une réputation de pay-to-win. La multiplication des paliers de prix agace (« pass fatigue »). Chez nous, **les cartes n'ont aucune corrélation rareté → puissance** (`statTotal` vient d'un hash, cf. `data/content/GUIDELINES.md`). C'est un argument rare dans le genre, à mettre en avant.

### 1.3 Hearthstone

- Mobile : **~18,6 M$ de revenus IAP en 2023** (AppMagic) [8], une franchise mûre en déclin.
- Ce qui marche : la poussière arcanique (désenchanter → crafter n'importe quelle carte), c'est notre modèle Influence. Le Tavern Pass (~20 $) ajoute un tier premium au passe de récompenses.
- Le reproche majeur : le coût d'une collection compétitive. Le craft déterministe est ce qui sauve sa réputation.

### 1.4 Clash Royale — Pass Royale

- Depuis octobre 2024, il ne reste qu'un **Free Pass + Diamond Pass** (~11,99 $). Le Gold Pass a été retiré [9].
- Leçon : Supercell a **simplifié** une gamme de passes trop fragmentée. Un seul produit premium clair vaut mieux que trois paliers (D1).

### 1.5 Duolingo Super (pour la rétention, pas pour le genre)

- T2 2026 : **58,7 M de DAU (+23 %)**, **12,7 M d'abonnés payants**, taux de rétention des utilisateurs actuels (CURR, J+1) record à **84 %** [10].
- Mécaniques : la **série** (streak) et son gel, les ligues hebdomadaires, des notifications très personnalisées. L'opération « Streak Revival » de juin 2026 a fait revenir **15,4 M** d'apprenants, dont ~8 M sans série active [10].
- Leçon pour MANDAT : nous avons déjà la série et un gel hebdomadaire gratuit. On peut ajouter une **réparation de série** (gratuite une fois par mois, plus fréquente en Premium) et des **campagnes de retour**. L'abonnement de Duolingo vend du *confort* (pas de pub, vies illimitées), pas de la puissance. C'est le bon modèle mental pour Mandat Premium.

### 1.6 Synthèse : ce qui est accepté et ce qui est détesté

| Accepté / apprécié | Détesté |
|---|---|
| Abonnement de confort avec un gain clair et prévisible | Pay-to-win, cartes puissantes réservées aux payeurs |
| Cosmétiques chers mais optionnels | Loot boxes payantes, cotes cachées |
| Garantie (pity) annoncée et respectée | FOMO à répétition, événements qu'on ne peut pas finir sans payer |
| Craft déterministe (« je peux viser une carte ») | Monnaies multiples qui cachent le vrai prix |
| Rituel court quotidien | Échanges bridés par des règles punitives |

---

## 2. Modèle économique recommandé

Principe directeur : **on vend du confort, du style et de l'accélération modérée, jamais de la puissance ni du
hasard payant.** Un joueur F2P doit pouvoir tout collectionner, et un abonné doit le ressentir dès le premier jour.

### 2.1 Mandat Premium (abonnement auto-renouvelable)

| Offre | Prix TTC (France) | Palier Apple | Remarques |
|---|---|---|---|
| Mensuel | **4,99 €** | 4,99 € | Le point d'entrée. Pocket est à 9,99 $ pour 1 booster/jour : nous donnons 2/jour pour moitié prix. |
| Annuel | **39,99 €** (soit 3,33 €/mois) | 39,99 € | Essai gratuit de 7 jours. Le meilleur choix pour la LTV et le churn. |
| Annuel « fondateur » (lancement seulement, 30 jours) | 29,99 € la 1ère année | 29,99 € | Offre d'introduction Apple (*introductory offer*, pay up front), puis 39,99 €. |

Revenu net par abonné, Small Business Program Apple (15 % de commission dès le 1er jour, sous 1 M$ de proceeds [11]) :
4,99 € TTC → 4,16 € HT (TVA 20 %) → **3,54 €** net/mois. 39,99 € → 33,33 € HT → **28,33 €** net/an (2,36 €/mois).

**Avantages (aucune carte exclusive à pouvoir) :**

1. **Réserve Premium : +2 boosters/jour.** C'est une seconde jauge, +1 booster toutes les 12 h, stock max 2. La jauge gratuite (12 h, stock 2) ne change pas. Total : 4/jour, et on ne perd rien en ne passant qu'une fois par jour. En BE/NL, la jauge est remplacée par +120 Influence/jour et 1 craft gratuit par semaine (D5).
2. **Piste Premium du passe de saison** (50 paliers, en parallèle de la piste gratuite) : ~15 boosters par saison, ~2 000 Influence, 1 dos de carte, 1 cadre, 1 avatar animé, 1 bannière et un titre de saison. Elle est rétroactive : un joueur qui s'abonne au palier 30 récupère les 30 paliers Premium.
3. **Cosmétique exclusif du mois**, qu'on garde à vie : avatar, bannière ou dos de carte, en rotation thématique (« Mois des Indépendances », etc.).
4. **Dotation hebdomadaire de 300 Influence** et 1 **craft gratuit** de carte jusqu'à épique par mois. Ce n'est pas aléatoire, ça accélère simplement la fin de collection.
5. **Badge « Mandat Premium »** sur le profil (discret, désactivable) et un liseré de cadre dans les listes d'amis.
6. **Quiz et duels** : 1 réparation de série supplémentaire par mois, l'historique complet des duels avec statistiques, des parties de quiz thématiques en illimité (le quiz quotidien récompensé reste identique pour tous), un mode duel « défi d'ami » avec des decks personnalisés. Les récompenses de quiz et de duel ne sont **jamais** multipliées : pas d'avantage compétitif.
7. **Confort** : rappels de jauge personnalisés, statistiques avancées de collection (taux de complétion par continent et par époque, doublons).

Pourquoi c'est « clairement mieux » sans être pay-to-win : un Premium assidu ouvre **5,0 boosters/jour contre 2,9**
en F2P et finit le set **~40 % plus vite** (section 3). Mais une carte n'a pas de puissance liée à sa rareté, et tout
reste accessible en F2P.

### 2.2 Passe de saison Premium : inclus dans l'abonnement ou vendu à part ?

**Choix : inclus dans Mandat Premium, et pas de vente séparée en v1.**

- Un seul produit est plus lisible. Supercell est revenu à un seul passe premium [9], et Marvel Snap est critiqué pour ses 3 paliers.
- Un passe vendu à part cannibalise l'abonnement (un passe par saison à 7,99 € vaut moins de 2 mois d'abonnement).
- La file des joueurs « anti-abonnement » est réelle. **Test en v1.2** : un *Passe de saison* non renouvelable à 7,99 € (piste Premium seule, sans Réserve Premium), proposé uniquement aux joueurs qui ont refusé l'abonnement 2 fois.

### 2.3 Monnaie premium : les « Sceaux »

- Une seule monnaie achetable. Le nom « Sceaux » colle au thème (le sceau de l'État). Achat in-app uniquement (consommable). **N'expire jamais** (règle Apple 3.1.1 [12]).
- Elle sert **uniquement** aux cosmétiques et au confort non aléatoire (section 2.4). **Pas de boosters, pas d'Influence, pas de sabliers.**
- Le **prix en euros** s'affiche à côté de chaque prix en Sceaux (principe n° 1 du réseau CPC, mars 2025 [15]). Les objets sont vendus par multiples de 100 Sceaux et le plus petit pack fait 100 Sceaux, pour que le joueur ne soit jamais forcé d'acheter un reliquat (principe CPC).
- On peut aussi acheter **directement en €** les cosmétiques phares. Le CPC déconseille d'obliger à passer par une monnaie.

| Pack | Prix TTC | Sceaux | Bonus |
|---|---|---|---|
| Poignée | 0,99 € | 100 | — |
| Bourse | 4,99 € | 520 | +4 % |
| Coffre | 9,99 € | 1 100 | +10 % |
| Trésor | 19,99 € | 2 300 | +15 % |
| Réserve d'État | 49,99 € | 6 000 | +20 % |

Il n'y a pas de pack au-delà de 49,99 €. Plafond par défaut de **100 €/mois par compte** (relevable sur demande pour
les majeurs), et **50 €/mois pour les comptes déclarés mineurs**.

**Faut-il vendre des boosters ?** Non (D3). Un booster est un objet aléatoire. Le vendre, même via les Sceaux, nous
classe en « loot box payante » au sens de PEGI (« Includes paid random items » [16]), le rend illégal en Belgique [17][18],
interdit aux mineurs au Brésil [19], et place le jeu dans le viseur du futur Digital Fairness Act [20]. Nous perdrions
aussi notre meilleur argument marketing. La Réserve Premium reste un objet aléatoire obtenu par abonnement : c'est
pourquoi on la neutralise en BE/NL et on affiche les cotes partout.

### 2.4 Boutique cosmétique

| Catégorie | Exemples | Prix indicatif |
|---|---|---|
| Dos de cartes | « Parchemin », « Tricolore », « Nuit électorale » | 300–600 Sceaux (2,99–5,99 €) |
| Cadres de carte (appliqués à toute la collection ou par carte) | Laiton, marbre, art déco | 400–800 Sceaux |
| Avatars | Portraits stylisés de symboles (Marianne, Liberty, cocarde…), **jamais** de figures vivantes | 200–400 Sceaux |
| Bannières de profil | Hémicycle, Agora, Forum romain | 300 Sceaux |
| Titres | « Constituant », « Plénipotentiaire » | 200 Sceaux, ou gagnés en jeu |
| Skins de booster | Enveloppe scellée, urne, valise diplomatique (animation d'ouverture) | 500–900 Sceaux |
| Effets d'ouverture | Feux d'artifice du 14 juillet, confettis de victoire | 400 Sceaux |
| Album (vitrine de collection) | Reliure cuir, classeur d'archives | 600 Sceaux |

Règles : rotation hebdomadaire de 6 objets plus un catalogue permanent, et **aucun objet ne disparaît pour toujours**
(il revient au moins une fois par an, ce qui évite le FOMO dur). Aucun cosmétique ne s'attache à une figure
**vivante** ou sensible (pas de « skin Macron doré »).

### 2.5 Offres de départ et offres uniques (éthiques)

- **Pack Fondateur** (une fois, J1 à J14) : 2,99 € = 400 Sceaux, plus un dos de carte « Fondateur » et un titre. Pas de compte à rebours agressif : une date de fin claire suffit.
- **1er mois Premium à 0,99 €** (offre promotionnelle Apple), proposé après la 1ère semaine de série complète.
- **Pas d'offre personnalisée** déclenchée par un échec, la frustration ou une session tardive. **Pas de « dernière chance »** répétée. Prix d'ancrage honnêtes : pas de « valeur 59,99 € » fictive.
- L'écran d'achat se dit « Soutenir MANDAT » quand c'est vrai : un jeu indépendant et éducatif, c'est un levier réel.

### 2.6 Pubs récompensées : non (D6)

- **La marque** : un jeu sur des figures politiques réelles, avec du contenu sensible (désaturé), à côté de pubs servies par un réseau (jeux de casino, paris sportifs, politique) crée un risque d'image fort.
- **La conformité** : ces SDK demandent le prompt ATT et une CMP (TCF) pour la RGPD, ce qui dégrade l'onboarding.
- **L'économie** : avec un eCPM rewarded FR typique de quelques euros et nos volumes, on parle de quelques centaines d'euros par mois. Ça ne vaut pas le coût en image.
- On réévalue en v2, **seulement** pour l'Afrique francophone (pouvoir d'achat faible, où l'abonnement convertit peu), en mode « +1 booster/jour en regardant une vidéo », avec un réseau à catégories filtrées.

### 2.7 Grille de prix récapitulative

| Produit | Type IAP | Prix TTC FR | Net estimé (15 %, après TVA) |
|---|---|---|---|
| Mandat Premium mensuel | Auto-renouvelable | 4,99 € | 3,54 € |
| Mandat Premium annuel | Auto-renouvelable (essai 7 j) | 39,99 € | 28,33 € |
| Annuel fondateur (lancement) | Offre d'introduction | 29,99 € la 1ère année | 21,25 € |
| Passe de saison seul (test v1.2) | Non renouvelable | 7,99 € | 5,66 € |
| Sceaux 100 / 520 / 1 100 / 2 300 / 6 000 | Consommable | 0,99 / 4,99 / 9,99 / 19,99 / 49,99 € | ×0,708 |
| Pack Fondateur | Non consommable | 2,99 € | 2,12 € |

**Ordre de grandeur des revenus** (hypothèses, à recalibrer après 30 jours de données) :

| Scénario | MAU | Abonnés (% MAU) | Payeurs Sceaux (% MAU, ARPPU 8 € TTC/mois) | Net/mois |
|---|---|---|---|---|
| Prudent | 30 000 | 3 % = 900 | 1,5 % = 450 | ≈ 2 800 € abo + 2 550 € Sceaux ≈ **5 300 €** |
| Central | 100 000 | 5 % = 5 000 | 1,5 % = 1 500 | ≈ 15 400 € + 8 500 € ≈ **24 000 €** |

Ces chiffres supposent 60 % de mensuels et 40 % d'annuels, soit ~3,07 € nets par abonné et par mois. Pour situer :
Pocket fait 30–50 M$/mois avec la licence Pokémon [13]. Nous n'avons ni la marque ni l'acquisition payante facile (D10) :
la croissance sera organique (presse, enseignants, réseaux), d'où l'importance de la section 5.

---

## 3. Simulation économique

### 3.1 Méthode

`scripts/economy/simulate.py` (Python 3, sans dépendance) reproduit les règles du serveur : cotes `DrawOdds`
(emplacements 1–4 à 65/25/10, emplacement 5 à 70/22/7/1), pity épique à 10 et légendaire à 40, finitions
holo 8 %, full art 3 %, or 0,3 %, bonus doublon, recyclage et craft (`EconomyRules`), XP et niveaux (`XpCurve`, un
booster tous les 2 niveaux), passe gratuit (`SeasonPassCatalog`), missions (`MissionCatalog` et `MissionAssigner`),
succès (~31 boosters et ~5 000 Influence au total), quiz (`QuizRules`) et duels (`DuelRules`). Une étape = un jour.
300 parties par profil, graine 2026, catalogue lu dans `data/cards.season1.json` (180 C, 120 U, 100 R, 60 E, 30 L, 10 M).

```
python3 scripts/economy/simulate.py --runs 300          # ~2 min
python3 scripts/economy/simulate.py --scenario tuned --runs 100
```

Profils simulés :

- **F2P occasionnel** : joue 5 jours sur 7, 0,5 quiz et 1 duel par jour actif, 60 % des missions quotidiennes.
- **F2P assidu** : 7 jours sur 7, 1 quiz (50 % parfaits), 3 duels (60 % de victoires), ~95 % des missions.
- **Premium occasionnel** et **Premium assidu** : mêmes comportements, plus la Réserve Premium (+2/jour), la piste Premium (15 boosters et 2 000 Influence par saison) et 300 Influence par semaine.

Le joueur simulé est rationnel : il recycle tous ses doublons (en gardant un exemplaire par couple carte+finition)
et crafte selon la meilleure des deux stratégies, « ratio » (la carte la plus longue à obtenir par unité d'Influence)
ou « rarest » (épargner pour la rareté la plus haute qui manque). C'est « rarest » qui gagne partout. Les vrais
joueurs gardent leurs doublons et craftent moins bien : il faut lire ces durées comme des **bornes basses**.

### 3.2 Résultats : économie actuelle (`current`)

Saison de 91 jours, passe à 50 paliers × 200 XP, craft 40/80/200/500/1 200/3 000.

| Profil | Boosters/j (91 j) | Cartes/j | % set J30 | % set J91 | % set J182 | Passe fini (j) | Niveau final |
|---|---|---|---|---|---|---|---|
| F2P occasionnel | 2,49 | 12,5 | 52 % | 85 % | 99 % | 43 | 49 |
| F2P assidu | 2,86 | 14,3 | 60 % | 89 % | 100 % | 21 | 71 |
| Premium occasionnel | 4,48 | 22,4 | 73 % | 97 % | 100 % | 34 | 53 |
| Premium assidu | 5,01 | 25,0 | 78 % | 100 % | 100 % | 18 | 74 |

Jours médians pour compléter chaque rareté (craft compris) :

| Profil | Commune | Peu com. | Rare | Épique | Légendaire | Mythique | **Set 500** | Set 500 (P90) |
|---|---|---|---|---|---|---|---|---|
| F2P occasionnel | 159 | 185 | 177 | 185 | 155 | 101 | **186** | 200 |
| F2P assidu | 125 | 131 | 128 | 129 | 110 | 71 | **131** | 143 |
| Premium occasionnel | 84 | 98 | 94 | 98 | 86 | 55 | **98** | 106 |
| Premium assidu | 74 | 81 | 79 | 80 | 70 | 42 | **81** | 87 |

(Les mythiques se complètent tôt parce que la stratégie optimale y met toute l'Influence en priorité : 10 cartes à 3 000.)

Finitions possédées au J365 et Influence gagnée :

| Profil | Holo | Full art | Or | Influence gagnée (1 an) |
|---|---|---|---|---|
| F2P occasionnel | 227 / 500 | 23 / 320 | 12 / 500 | ~98 000 |
| F2P assidu | 248 / 500 | 26 / 320 | 14 / 500 | ~141 000 |
| Premium occasionnel | 332 / 500 | 41 / 320 | 23 / 500 | ~191 000 |
| Premium assidu | 349 / 500 | 44 / 320 | 25 / 500 | ~239 000 |

Sources d'Influence :

| Profil | Recyclage | Bonus doublons | Missions | Passe | Niveaux | Succès | Quiz | Duels | Premium |
|---|---|---|---|---|---|---|---|---|---|
| F2P occasionnel | 51 % | 13 % | 12 % | 11 % | 2 % | 5 % | 3 % | 3 % | — |
| F2P assidu | 42 % | 10 % | 18 % | 8 % | 2 % | 3 % | 6 % | 10 % | — |
| Premium assidu | 50 % | 12 % | 10 % | 5 % | 2 % | 2 % | 3 % | 6 % | 10 % |

### 3.3 Diagnostic

1. **L'économie est déjà généreuse**, et c'est très bien : un F2P assidu finit le set en **~4,3 mois** (Pocket : plus d'un an selon les joueurs [14]). C'est notre promesse anti-pay-to-win.
2. **Le passe gratuit se finit en 21 jours** pour un assidu (18 en Premium) sur une saison de 91 jours : 10 semaines sans objectif de passe. **C'est le défaut principal.**
3. **Le craft fait la fin de collection** : à partir de ~85 %, ce sont les crafts de légendaires et de mythiques qui comptent. Les coûts de craft des hautes raretés sont donc le levier de réglage le plus fin. Changer le % de set à J91 se fait surtout via le nombre de boosters.
4. **La chasse aux finitions ne s'épuise jamais** : après un an, un F2P assidu a ~14 cartes or sur 500. C'est le contenu « long terme » idéal, purement esthétique. On ne la monétise pas directement, mais elle donne de la valeur aux cosmétiques (cadres, album) et à la Réserve Premium.
5. **Premium contre F2P assidu** : ×1,75 de boosters par jour, set complet en 81 jours au lieu de 131 (−38 %). C'est sensible sans être écrasant. +2/jour est le bon dosage : avec +1/jour, la différence (~−20 %) serait trop faible pour justifier 4,99 €.

### 3.4 Réglage proposé (`tuned`, D7)

Changements : saisons de **98 jours** (14 semaines, alignées sur 4 saisons par an avec une semaine d'intersaison),
**400 XP par palier** et craft **épique 600, légendaire 1 500, mythique 4 000** (au lieu de 500/1 200/3 000).
Commune, peu commune et rare sont inchangées, ainsi que le recyclage et les bonus doublon.

| Profil | Boosters/j | % set J30 | % set J91 | Passe fini (j) | **Set 500 (médiane)** | Set 500 (P90) |
|---|---|---|---|---|---|---|
| F2P occasionnel | 2,46 | 51 % | 84 % | 92 (fin de saison) | **221** | 247 |
| F2P assidu | 2,86 | 57 % | 88 % | 44 | **157** | 170 |
| Premium occasionnel | 4,50 | 70 % | 95 % | 76 | **114** | 123 |
| Premium assidu | 5,01 | 76 % | 99 % | 39 | **94** | 101 |

Effets :

- Le passe dure ~6 semaines pour un assidu et toute la saison pour un occasionnel. Il reste un objectif pendant la saison.
- **Premium assidu : set complet dans la saison** (94 j sur 98) : « Avec Premium, je finis la saison ». **F2P assidu : 88 % en fin de saison**, et le set complet au début de la saison suivante (157 j). Les cartes de la saison 1 restent obtenables ensuite par un booster « Archives » et le craft.
- L'occasionnel F2P garde plus de 80 % du set à la fin de la saison 1 : c'est une part significative qui le motive.

Autres réglages à prévoir (non simulés) :

- **Saison 2** : +150 à 200 cartes. Garder le booster de la saison en cours comme standard, et la saison 1 dans un booster « Archives » au choix.
- **Booster thématique choisi** (continent) : il accélère la complétion d'un continent ; le modèle suppose des boosters standard.
- **Recyclage de finitions** : x2, x4 et x10 rendent un or recyclé très rentable (4 000 Influence pour un mythique or). C'est voulu, mais il faut surveiller l'inflation d'Influence en v1.2 via les KPI (section 6).

### 3.5 Économie de craft : appliquée le 19/10/2026 (scénario `rebalanced`)

**Demande** : on obtient trop d'Influence. Un F2P actif devait pouvoir fabriquer **au plus ~1 carte tous les 2 jours en moyenne**.
**Contrainte** (revue TCG, `docs/TCG_REVIEW.md` §3.4) : garder un ratio lisible, « **10 doublons d'une rareté = 1 carte de cette rareté** ». Les doublons ne doivent jamais devenir sans valeur.

**Mesure de départ** (`current`, le joueur fabrique dès qu'il peut) : un F2P assidu gagne **400 Influence/j** pour un craft moyen à 136. Il pourrait donc fabriquer **2,9 cartes/jour**, presque toutes des communes. Avec quiz et duels illimités (profil « acharné » : 6 quiz et 12 duels par jour), il monte à **715/j**, dont 139 de quiz et 158 de duels.

**Pourquoi le ratio 1:10 ne suffit pas seul.** Un F2P assidu tire ~14 cartes par jour, dont ~8–9 doublons. Avec 1:10, le recyclage seul finance déjà **~0,9 craft par jour** de la même rareté. Même en coupant toutes les autres sources (variante `ratio10_min_faucets`), on reste à **1,15 craft/j**. Avec un ratio 1:20 (`ratio20`), c'est encore **1,25**. Grille 1:10 et sources coupées sans plafond de craft (`rebalanced_no_allowance`) : **1,57 craft/j**. Le rythme visé ne peut donc pas venir du seul prix : il passe par un **quota de fabrication côté serveur**. C'est la règle qu'on peut expliquer au joueur.

**Ce qui est livré (API = source unique, exposée par `GET /api/v1/economy` et `GET /api/v1/limits`)** :

| Rareté | Craft | Recyclage (standard) | Bonus doublon (fixe) |
|---|---|---|---|
| Commune | 100 | 10 | 2 |
| Peu commune | 200 | 20 | 4 |
| Rare | 500 | 50 | 10 |
| Épique | 1 200 | 120 | 25 |
| Légendaire | 3 000 | 300 | 60 |
| Mythique | 8 000 | 800 | 150 |

- **Multiplicateurs de finition sur le recyclage seulement** : holo ×2, full art ×4, **or ×5** (au lieu de ×10). Le bonus doublon à l'ouverture est fixe.
- **Quota de fabrication** : **1 craft gagné toutes les 48 h, stock max 3**, 1 au départ. C'est minuté comme les boosters : on ne cumule pas au-delà du stock. Erreur `craft_limit_reached` (409), compte à rebours dans l'app.
- **Plafonds quotidiens** (jour local du joueur) : **3 quiz récompensés** et **5 victoires en duel récompensées**. Au-delà, le jeu continue et rapporte de l'XP, mais plus d'Influence ni de progression vers le booster des quiz parfaits. L'app reçoit `rewardCapped` / `capped` et le reste du jour via `/limits`.
- **Autres sources réduites** :

| Source | Avant | Après |
|---|---|---|
| Niveau | 50 | 20 |
| Missions | 20 à 200 | ×0,3, arrondi à 5 (5 à 60) |
| Succès | 25 à 400 par palier | ×0,4 (10 à 160) |
| Paliers Influence du passe | 50 + 10 × (palier/10) | 20 + 5 × (palier/10) |
| Quiz | 2/bonne réponse + 10 si parfait | 1 + 5 |
| Duel | 10/20/35, nul 5, défaite 3 | 4/6/10, nul 2, défaite 1 |

- **Aucun effet rétroactif** : les soldes d'Influence et les collections existants ne changent pas. Seuls les gains et coûts à venir suivent la nouvelle grille.

**Résultats** (80 parties par profil, horizon 730 j, saison de 91 j, `python3 scripts/economy/simulate.py --scenario rebalanced --runs 80`) :

| Profil | Influence/j avant → après | **Crafts/j avant → après** | Craft moyen | % set J91 | **Set 500 (médiane)** avant → après |
|---|---|---|---|---|---|
| F2P occasionnel | 271 → 278 | 2,43 → **0,50** | 538 | 87 % | 184 → **324 j** |
| F2P assidu | 400 → 370 | 2,89 → **0,51** | 709 | 90 % | 132 → **268 j** |
| F2P acharné (6 quiz, 12 duels/j) | 715 → 475 | 3,34 → **0,51** | 904 | 93 % | 86 → **226 j** |
| Premium occasionnel | 494 → 646 | 2,61 → **0,50** | 1 249 | 97 % | 99 → **160 j** |
| Premium assidu | 635 → 771 | 2,87 → **0,50** | 1 488 | 98 % | 82 → **130 j** |

*« Avant » : crafts/j mesurés en fabriquant dès que possible, et set complet avec la meilleure stratégie de craft. « Après » : le quota décide du rythme, et le joueur garde ses crafts pour la carte la plus rare qu'il peut se payer.*

Sources d'Influence par jour pour un F2P assidu, saison 1 : recyclage 229, bonus doublons 52, missions 28, passe 13, niveaux 8, succès 16, quiz 11, duels 12. Le recyclage représente 62 % du total.

Effets :

- **Le craft devient un choix** : on fabrique une rare ou une épique tous les 2 jours (23 et 17 crafts par saison pour un F2P assidu), presque plus jamais de communes. Les communes et peu communes viennent des boosters.
- **Les doublons gardent leur valeur** : « 10 doublons = 1 carte » se lit tel quel. Le joueur accumule de l'Influence plus vite qu'il ne peut la dépenser, donc il a toujours de quoi fabriquer quand le quota se libère.
- **La fin de collection ralentit** : set complet en ~9 mois pour un F2P assidu (au lieu de ~4,3), ~4,3 mois pour un Premium assidu. Le % de set à la fin de la saison 1 reste élevé (87 à 98 %), car ce sont les boosters qui le portent.
- **Le farming est borné** : l'« acharné » ne gagne plus que ~30 % de plus qu'un assidu, contre ~80 % avant.

**À surveiller / suite** : l'Influence s'accumule sans autre usage que le craft. Les puits proposés par la revue TCG (§3.4 : améliorer une finition, crafter une finition holo, relancer une mission) deviennent prioritaires en v1.2, avec le KPI « Influence moyenne non dépensée ». La promesse « Premium finit la saison » ne tient plus : le Premium garde ×1,75 de boosters et 98 % du set à J91, mais le set complet demande ~130 j. À décider : avantage de quota Premium (par exemple stock 4) ou non.

---

## 4. Conformité stores et droit (critique)

### 4.1 Apple App Store

- **3.1.1** : tout déblocage de contenu ou de fonction numérique passe par l'IAP (abonnement, monnaie, contenus premium). Les monnaies achetées **n'expirent pas**. Il faut un mécanisme de **restauration**. *« Apps offering “loot boxes” or other mechanisms that provide randomized virtual items for purchase must disclose the odds of receiving each type of item to customers prior to purchase. »* [12] → La Réserve Premium donne des objets aléatoires liés à un paiement : **l'écran de cotes (déjà là : `GET /packs/{id}/odds`) doit être accessible depuis le paywall Premium**, avant l'achat.
- **3.1.2(a)** : un abonnement doit apporter une **valeur continue**, durer **au moins 7 jours** et marcher sur tous les appareils de l'utilisateur. Il peut inclure des consommables (monnaie, crédits). Il est interdit de conditionner ce qui a été payé à des tâches (« se connecter X fois », partager…) [12]. → Les +2 boosters/jour s'accumulent dans un stock : l'abonné n'a pas à se connecter toutes les 12 h pour en profiter, mais un plafond reste admissible (stock de 2). La piste Premium du passe demande de l'XP : il faut **documenter dans la fiche que la piste se débloque en jouant**, et donner aussi une valeur immédiate (cosmétique du mois et dotation hebdomadaire versés automatiquement).
- **Paywall** : prix, période, renouvellement automatique, lien vers les CGU et la politique de confidentialité, gestion de l'abonnement. Pas de bouton de fermeture caché (risque de rejet au titre de 3.1.2 « bait-and-switch »).
- **5.1.1** : politique de confidentialité dans l'app et dans App Store Connect. Le consentement est requis même pour des données « anonymes ». **Aucune fonction payante ne doit dépendre d'un consentement aux données** [12].
- **Classification** : nouveau questionnaire d'âge Apple (4+/9+/13+/16+/18+, obligatoire depuis le 31/01/2026) [21]. Déclarer les achats intégrés et les objets aléatoires → viser **13+**. Le contenu historique (dictatures, génocides décrits factuellement) va dans le même sens.
- **1.1.1** : les contenus diffamatoires ou discriminatoires sont exclus. La satire politique est tolérée, mais nous ne faisons pas de satire : **le ton neutre de `GUIDELINES.md` est notre protection**. Le **1.1.7** interdit de « profiter d'événements actuels » (conflits, attentats) : **pas d'événement ni de booster lié à une guerre en cours**.
- **Small Business Program** : 15 % de commission sous 1 M$ de proceeds [11].

### 4.2 Google Play (Android plus tard)

- Google Play Billing est obligatoire pour les biens numériques. Les **cotes des objets aléatoires** doivent être affichées avant l'achat (règle depuis mai 2019) [22]. Il y a aussi les règles Familles si le public cible inclut des mineurs : on vise 13+ et on n'entre pas dans le programme Familles.
- RevenueCat couvre Billing v7+, il n'y a pas de travail spécifique à prévoir.

### 4.3 UE et France

| Sujet | Statut (oct. 2026) | Ce que ça implique pour nous |
|---|---|---|
| **Belgique** | Les loot boxes payantes sont des jeux de hasard illégaux depuis 2018 (Commission des jeux), avec jusqu'à 800 000 € d'amende et 5 ans de prison [18]. L'application est faible (82 % des jeux du top iPhone BE avaient encore des loot boxes [23]), mais Nintendo et The Pokémon Company se retirent (Pocket indisponible en BE, UNITE fermé en BE/NL fin 2025) [17]. | **Marché francophone clé.** Version sans objet aléatoire payant : en BE, la Réserve Premium donne de l'Influence et un craft (D5). Les Sceaux n'achètent que des cosmétiques, donc aucun problème. |
| **Pays-Bas** | Le Conseil d'État a jugé le 9/3/2022 que les packs FIFA ne sont pas des jeux de hasard [18]. Le gouvernement veut une interdiction (motion Bontenbal) et pousse pour qu'elle figure dans le DFA [20][24]. | Même traitement que la Belgique, par prudence (D5). Coût faible : peu de joueurs. |
| **France** | Pas d'interdiction des loot boxes. La **loi SREN (21/05/2024), art. 40–41** crée les **JONUM** (jeux à objets numériques monétisables) : sacrifice financier + hasard + objets **cessibles à titre onéreux**, sous un régime expérimental de 3 ans encadré par l'ANJ, en vigueur depuis février 2026 [25][26]. | Nos cartes **ne sont pas cessibles contre de l'argent** : pas de marketplace, pas de NFT, pas de retrait. CGU : interdiction de revente de comptes ou de cartes. Les échanges entre amis restent gratuits et plafonnés (D9). On reste ainsi **hors JONUM**. ⚖️ Faire valider. |
| **Réseau CPC (UE)**, principes sur les monnaies virtuelles (21/03/2025) [15] | Droit souple appuyé sur la directive sur les pratiques commerciales déloyales et la directive sur les droits des consommateurs : prix réel en €, pas de multiplication des monnaies, pas d'achat forcé de reliquats, information précontractuelle, droit de rétractation, protection des mineurs. Amendes nationales possibles. | Une seule monnaie achetable, le prix en € toujours affiché, des packs ajustés aux prix des objets. |
| **Digital Fairness Act** | Pas encore déposé, proposition attendue au T4 2026 (on parle du 11/11/2026), application pas avant 2028 [20][27]. Les pistes : prix réel des monnaies, *dark patterns*, pièges à l'abonnement, loot boxes (transparence minimale, interdiction possible pour les mineurs). | Notre modèle (pas de booster payant, une monnaie, résiliation en 1 clic via le store) est **déjà aligné**. Il faut surveiller la proposition. |
| **PEGI** | Le descripteur « Achats intégrés (inclut des objets aléatoires payants) » s'applique dès qu'un objet aléatoire s'obtient contre de l'argent réel, directement ou via une monnaie [16]. | À cause de la Réserve Premium, il faut **déclarer « inclut des objets aléatoires »** si on obtient une classification IARC/PEGI (Google Play). C'est honnête, et l'impact reste modéré. |
| **Brésil** (marché lusophone, hors cible v1) | La loi 15.211/2025 (ECA Digital) et le décret 12.880/2026 interdisent les loot boxes dans les jeux accessibles aux mineurs [19]. | Même traitement que BE/NL si on lance au Brésil. |
| **Australie** | Depuis le 22/09/2024, une loot box payante entraîne une classification M minimum [28]. | Déclarer, sans impact majeur. |

**Droit de la consommation (France / UE)**

- **Rétractation de 14 jours** pour un contenu numérique : on la perd si l'exécution commence avec l'accord préalable exprès du consommateur et sa reconnaissance de la perte du droit (directive 2011/83/UE art. 16 m ; C. conso. L221-28 13°). Sur iOS, Apple est le vendeur et gère les remboursements (« Signaler un problème »). Nous traitons les notifications `REFUND` (section 7).
- **Prix TTC affichés** : le store les fournit (TVA à 20 % incluse en France, et Apple reverse la TVA UE).
- **Abonnement** : la résiliation se fait dans les réglages du store. On affiche un lien direct « Gérer mon abonnement » dans Réglages. La loi « résiliation en 3 clics » (2023) vise les contrats conclus en ligne : le store la couvre, mais **notre écran Réglages doit y renvoyer en 1 clic**.
- **Mineurs** : âge minimum 13 ans (CGU), et consentement parental pour les 13–15 ans en France (art. 45 de la loi Informatique et Libertés, majorité numérique à 15 ans) si l'on traite des données sur la base du consentement. Pas d'offre ciblée vers les mineurs. Plafond de dépenses par défaut (section 2.3). Le contrôle parental d'Apple (Ask to Buy) s'applique automatiquement.

**RGPD / ATT**

- **Pas d'IDFA, pas de pistage inter-apps → pas de prompt ATT.** L'attribution passe par **AdAttributionKit / SKAdNetwork**, qui ne demande pas l'ATT.
- La mesure d'audience se fait en first-party (événements envoyés à notre API) et/ou via un outil hébergé dans l'UE (section 6). La CNIL exempte de consentement la mesure d'audience strictement nécessaire (finalité limitée, données agrégées, pas de recoupement). Au-delà (A/B tests, profils marketing), il faut un consentement opt-in.
- Les webhooks RevenueCat contiennent des identifiants d'achat : à ajouter au registre de traitements, avec un DPA RevenueCat (sous-traitant établi aux US, DPF).

### 4.4 Sensibilité du contenu politique ⚖️

- **Droit à l'image et à la personnalité des figures vivantes** : vendre l'accès (abonnement) à des cartes de personnes vivantes, c'est une exploitation commerciale de leur image et de leur nom. En France, l'exception d'information sur la vie publique couvre mal le *merchandising*. Les portraits Wikimedia sont sous licence CC, mais **la licence du photographe ne vaut pas consentement de la personne représentée**. Mesures :
  - (a) **jamais de figure vivante** dans les visuels marketing, la boutique, les cosmétiques ou les noms de produits ;
  - (b) aucune carte **précise** n'est vendue (le hasard et le craft valent pour tout le catalogue) ;
  - (c) un ton strictement factuel ;
  - (d) une procédure de retrait sur demande ;
  - (e) **consultation d'un avocat en droit de la personnalité avant l'activation des paiements.** C'est **le risque juridique n° 1**, devant les loot boxes.
- **Publicité** : depuis le 10/10/2025 (règlement TTPA), Meta et Google **ne diffusent plus de publicité politique dans l'UE** [29]. Une pub montrant des politiciens réels a de bonnes chances d'être classée politique et rejetée. Meta exige ailleurs une autorisation pour les pubs « about political figures » [30]. Pas non plus d'Apple Search Ads sur des mots-clés de noms de politiciens vivants.
- **Mise en avant par les stores** : la thématique politique réduit les chances de *featuring*. On positionne MANDAT comme un jeu « **histoire et culture générale** » (catégorie Jeux > Cartes, sous-catégorie Éducation) et l'écran d'accueil de la fiche montre des figures historiques (Cléopâtre, Mandela, de Gaulle…).
- **Figures sensibles** : déjà désaturées, jamais en « Figure du jour », jamais dans l'onboarding. On ajoute : **jamais dans un booster thématique, un événement, un cosmétique ou une notification**. Une carte sensible ne doit jamais porter de finition or animée (aujourd'hui : finition « muted »).
- **Calendrier électoral** : les « nuits électorales » (section 5) ne mettent en avant **aucun candidat en lice** pendant la campagne officielle du pays concerné. On célèbre l'institution (l'histoire des présidences, des parlements), pas les candidats. Les comptes rendus de campagne sont réglementés en France (CSA/Arcom) : un jeu n'est pas un média, mais on reste prudent.

### 4.5 Ce qu'on vend où

| Pays / vitrine | Abonnement | Réserve Premium (+2 boosters) | Sceaux et cosmétiques | Boosters payants |
|---|---|---|---|---|
| France, Suisse, Canada, Luxembourg, Afrique francophone, reste du monde | Oui | Oui, cotes affichées sur le paywall | Oui | **Non (nulle part)** |
| Belgique, Pays-Bas | Oui | **Non** : remplacée par +120 Influence/jour et 1 craft/semaine | Oui | Non |
| Brésil (si lancé) | Oui, 18+ ; version sans Réserve pour les mineurs | Majeurs uniquement | Oui | Non |

Détection : `Storefront.countryCode` (StoreKit 2) côté app et le pays de la vitrine dans les webhooks RevenueCat côté
serveur. **Le serveur décide** des avantages appliqués. Les **cotes restent affichées partout**, y compris sur les
boosters gratuits (déjà fait).

---

## 5. Rétention et motivation

### 5.1 Boucle principale et sessions

- **Session 1, le matin (2–3 min)** : jauge pleine → ouvrir 2 boosters (4 en Premium) → recycler et crafter → quiz du jour (10 questions).
- **Session 2, à midi ou le soir (3–5 min)** : 1 à 3 duels, missions, Pioche diplomatique chez un ami.
- **Session 3, optionnelle** : collection, album, profil des amis, boutique.

La jauge de 12 h avec un stock de 2 **pardonne** : un passage par jour suffit à tout récupérer. On garde ça.
La Réserve Premium suit la même logique.

### 5.2 Objectifs de rétention

Les benchmarks GameAnalytics 2025 (tous genres) donnent une médiane J1 ~22 %, un top quartile ~30 % et un top
décile ~40 % ; une médiane J7 < 4 % et un top 10 % à 11–12 % ; une médiane J30 < 1 % et un top 25 % à 1,6–1,8 % [31].
Les jeux de cartes font partie des genres qui retiennent le mieux à moyen et long terme [31]. Ce sont des moyennes
« tous jeux », plombées par l'hypercasual.

| KPI | Seuil d'alerte | Objectif v1.1 | Objectif v2 |
|---|---|---|---|
| J1 | < 30 % | **40 %** | 45 % |
| J7 | < 12 % | **18 %** | 22 % |
| J30 | < 4 % | **8 %** | 10 % |
| DAU/MAU | < 15 % | 25 % | 30 % |
| Sessions/jour (DAU) | < 1,5 | 2,2 | 2,5 |

### 5.3 Onboarding : les moments de la 1ère session

1. **Moins de 60 s : le premier booster** (composition garantie, déjà fait) : 1 épique+, 5 continents, au moins 3 époques. L'animation d'ouverture doit être la plus belle de l'app.
2. **Le 2e booster est disponible tout de suite** (stock initial plein). On montre la jauge : « Prochain booster dans 12 h, ou passez demain matin, ils s'accumulent. »
3. **Premier aperçu du pity** : « Encore 8 boosters pour une épique garantie, 38 pour une légendaire. » C'est la jauge de pity visible (les données existent : `PityDto`). Elle rassure et donne un horizon.
4. **Premier craft** : on donne 100 Influence dans le tutoriel pour fabriquer une commune manquante. Ça apprend que **le hasard n'est pas la seule voie**.
5. **Premier quiz** (3 questions de démo) pour lier le jeu à l'apprentissage.
6. **Fin de session** : demande de permission des notifications avec un écran explicatif avant le prompt système, **après** le 2e booster (« Te prévenir quand ta jauge est pleine ? »), jamais au lancement.
7. **Paywall** : **jamais en J0**. Première présentation douce en J3, ou après 6 boosters ouverts (« Avec Premium, tu en aurais ouvert 12 »).

### 5.4 Calendrier de connexion, séries, objectifs

- **Calendrier de connexion de 7 jours qui ne se remet pas à zéro** (on reprend où on s'est arrêté) : Influence aux J1 à J6, booster au J7. Puis un **calendrier mensuel** de 28 cases avec un cosmétique à la case 28.
- **Série** (existe déjà, avec un gel hebdomadaire gratuit) : on ajoute une **réparation** gratuite une fois par mois (2 en Premium) et des paliers 7/30/100/365 avec titres et cadres.
- **Albums** : par continent, par époque et par thème (« Femmes d'État », « Pères fondateurs », « Décolonisation »). Finir un album donne un cosmétique, un titre et des Influences. C'est le **principal moteur de fin de collection**, en plus du craft.
- **Collection de finitions** : vitrine « Galerie dorée » qui montre les cartes or, et une plaque par palier (10/25/50 cartes holo…).

### 5.5 Événements hebdomadaires et calendrier réel

Rythme : **1 événement thématique par semaine**, d'une durée de 7 jours, et **1 grand événement par mois**.

| Type | Mécanique | Exemples |
|---|---|---|
| Booster thématique (gratuit) | Pendant l'événement, le booster du jour peut être pris dans un pool thématique, avec les mêmes cotes publiées | « Pères fondateurs » (semaine du 4 juillet), « Indépendances africaines » (autour des fêtes nationales d'août), « Femmes d'État » (8 mars), « Révolutions » (14 juillet) |
| Défi thématique | Missions dédiées et une bannière à gagner | Quiz « Constitution de 1958 » le 4 octobre |
| Nuits électorales | Quiz et duels sur **l'histoire** des élections d'un pays, **sans aucun candidat en lice** (section 4.4) | Élections américaines (novembre), européennes |
| Anniversaires historiques | Une figure du jour mise en avant, une bio étendue, un quiz | Chute du mur (9/11), Mandela Day (18/7) |
| Événement cosmétique limité | Un dos de carte ou un cadre à gagner **en jouant**, puis en vente en Sceaux l'année suivante | « Hiver des congrès » |

Règle anti-FOMO : toute récompense d'événement s'obtient en **≤ 40 min de jeu cumulé sur la semaine** en F2P, et
revient au moins une fois par an.

### 5.6 Échanges et Pioche diplomatique

**Pioche diplomatique** (à la manière du Wonder Pick) : quand un ami ouvre un booster contenant une rare+, ses amis
peuvent, pendant 24 h, piocher **une carte à l'aveugle** parmi les 5, contre 1 « Jeton diplomatique ». Les jetons
s'obtiennent gratuitement (1 par jour, stock 3). Ça crée une **boucle sociale** et une raison de revenir, sans
paiement. La pioche est aléatoire mais gratuite : ce n'est pas une loot box payante.

**Échanges entre amis** : on recommande la **v1.2** avec ces garde-fous :

| Garde-fou | Raison |
|---|---|
| Seulement entre amis depuis au moins 7 jours, compte de niveau 10 ou plus | Anti-bot et anti-multicompte (la vraie raison des règles de Pocket [6]) |
| Rareté égale, au plus épique (pas de légendaire ni de mythique) | Pas de marché parallèle sur les cartes chères |
| 1 échange par jour, coût en Influence (20/40/100/250 selon la rareté) | Limite le farming, et l'Influence sert de puits |
| Finition standard seulement | L'or reste personnel et prestigieux |
| Les cartes reçues par échange ne peuvent pas être recyclées pendant 7 jours | Bloque le blanchiment d'Influence via des comptes secondaires |
| Détection : graphes d'échanges denses, comptes récents, même appareil (identifiant installé, pas l'IDFA) | Anti-fraude |
| CGU : interdiction de toute contrepartie financière | Rester hors JONUM (section 4.3) |

### 5.7 Duels classés

- Une **ligue** par saison : Bronze → Argent → Or → Platine → « Chef d'État », sur 5 rangs × 3 étoiles. Classement Elo caché pour l'appariement contre l'IA ou en asynchrone.
- Récompenses de fin de saison : un cosmétique par ligue et de l'Influence. **Aucune carte exclusive.**
- Saison de ligue = saison du passe (98 jours), avec une remise à zéro partielle.
- Comme la rareté n'a pas de lien avec la puissance, le classement ne dépend pas de la dépense. C'est un argument à mettre en avant.

### 5.8 Classements et partage

- **Classement de collection entre amis** : % du set, cartes or, séries. Hebdomadaire et global.
- **Partage** : une image générée de la carte rare tirée (aux couleurs de MANDAT, sans figure sensible), un « Mon album Afrique est complet », un score de quiz. Lien profond avec un code ami → un booster bonus pour les deux après 3 jours de jeu du filleul (le parrainage est limité à 10).

### 5.9 Notifications push

L'opt-in se demande après le 2e booster (section 5.3). Les catégories sont réglables dans Réglages.

| Notification | Déclencheur | Plafond |
|---|---|---|
| Jauge pleine | Stock plein depuis 1 h, à l'heure habituelle de jeu | Au plus 1 par jour |
| Série en danger | 20 h locale si pas encore joué et série ≥ 3 | 1 par jour, jamais si une jauge pleine a déjà été envoyée dans les 4 h |
| Ami : demande, Pioche dispo, défi de duel | Événementiel | Regroupement, 2 par jour maximum |
| Début d'événement | Lundi 12 h | 1 par semaine |
| Fin de passe proche | J−3 de la fin de saison, si des paliers ne sont pas réclamés | 1 par saison |

Règles générales : **au plus 2 notifications par jour, 8 par semaine**, aucune entre 21 h et 9 h (heure locale),
**aucune notification commerciale** (prix, promotions) sans opt-in marketing séparé. Après 3 notifications ignorées
de suite, on réduit la fréquence de moitié.

### 5.10 Retour des joueurs partis

- **J+3 d'inactivité** : « Tes 2 boosters t'attendent » (vrai : le stock est plein).
- **J+7** : « Ta série de 12 jours peut encore être réparée » (si une réparation est disponible).
- **J+14, puis J+30** : récapitulatif « Ce que tu as manqué » (nouvel événement, cartes ajoutées) et un **cadeau de retour** de 3 boosters et 300 Influence, réclamable une fois tous les 60 jours.
- Pas plus de 3 messages de retour, puis silence.
- L'abonné Premium qui résilie voit à l'expiration un récapitulatif de ce qu'il a obtenu et une offre de retour (−50 % le 1er mois) une seule fois, 30 jours plus tard.

### 5.11 Feuille de route priorisée

L'effort est estimé en semaines-développeur, pour un développeur full-stack seul.

| Version | Contenu | Effort |
|---|---|---|
| **v1.1 — monétisation de base (≈ 6–7 sem.)** | RevenueCat, table `entitlements` et webhooks (section 7) · Mandat Premium (paywall, Réserve Premium, piste Premium, dotation, cosmétique du mois) · règles BE/NL · Réglages « Gérer l'abonnement », restauration · cotes accessibles depuis le paywall · application du réglage `tuned` | 4 |
| | Calendrier de connexion de 7 jours, réparation de série, jauge de pity visible, tutoriel de craft | 1 |
| | Notifications push (expo-notifications, plafonds, quiet hours, opt-in après le 2e booster) | 1 |
| | Analytique first-party et tableau de bord KPI | 1 |
| **v1.2 — social et contenu (≈ 7–8 sem.)** | Sceaux et boutique cosmétique (dos, cadres, avatars, skins de booster) | 2 |
| | Pioche diplomatique | 1,5 |
| | Échanges entre amis avec anti-fraude | 2 |
| | Albums thématiques et récompenses | 1 |
| | Moteur d'événements hebdomadaires (pools thématiques, missions, calendrier configurable côté serveur) | 1,5 |
| **v2 — compétition et saison 2 (≈ 8–10 sem.)** | Duels classés avec ligues et saisons | 2,5 |
| | Saison 2 (150–200 cartes) et booster « Archives » | 3 (dont contenu) |
| | Classements entre amis, partage d'image, parrainage | 1,5 |
| | Android (Play Billing via RevenueCat, classification IARC) | 1,5 |
| | Test du passe de saison seul et éventuelles pubs en Afrique | 1 |

---

## 6. Analytique et KPI

### 6.1 Outils

- **Events first-party** : `POST /api/v1/events` en lot vers notre API, stockés dans Postgres (une table partitionnée par mois), puis agrégés en SQL (Metabase). Ça permet la mesure exemptée de consentement CNIL (agrégée, finalité de mesure seulement). C'est le **socle**.
- **PostHog Cloud EU** (Francfort, auto-hébergeable) **avec consentement** pour les entonnoirs fins, les feature flags et les A/B tests. Alternative minimaliste : TelemetryDeck (pensé pour la vie privée).
- **RevenueCat** pour les métriques d'abonnement (MRR, essais, churn, LTV).
- **Pas d'IDFA ni d'ATT.** L'attribution des campagnes passe par AdAttributionKit / SKAN et les liens de campagne App Store (`pt`, `ct`).

### 6.2 Événements à suivre

| Domaine | Événements (propriétés clés) |
|---|---|
| Cycle de vie | `app_open` (source : push/organique), `session_start/end`, `signup` (méthode), `tutorial_step` (n°) |
| Boosters | `pack_opened` (pack_id, source : gratuit/premium/bonus, pity), `card_drawn` (rareté, finition, nouvelle), `odds_viewed` (depuis : booster/paywall) |
| Économie | `influence_earned` / `influence_spent` (source), `card_recycled`, `card_crafted` (rareté), `sceaux_purchased` / `sceaux_spent` |
| Progression | `level_up`, `pass_tier_reached` (piste), `mission_completed`, `streak_extended` / `streak_broken` / `streak_repaired`, `album_completed` |
| Jeu | `quiz_completed` (score, parfait), `duel_finished` (difficulté, résultat), `pioche_used`, `trade_completed` |
| Monétisation | `paywall_viewed` (placement, variante), `trial_started`, `subscription_started` / `renewed` / `cancelled` / `expired` / `refunded` (côté serveur, via webhook), `shop_viewed`, `item_purchased` |
| Social | `friend_request_sent` / `accepted`, `share` (type), `referral_installed` |
| Notifications | `push_permission` (accordée/refusée), `push_sent` (catégorie), `push_opened` |

### 6.3 KPI

- Rétention J1/J7/J30, DAU/MAU, sessions par jour, durée de session.
- Conversion vers l'essai, de l'essai vers le payant (cible ≥ 40 % sur l'annuel), churn mensuel (cible < 12 %), part d'annuels.
- ARPDAU, ARPPU, % de payeurs, LTV J90 par cohorte.
- Économie : boosters/jour par segment, **% du set à J30/J91** comparé à la simulation, **stock d'Influence médian** (alerte inflation si > 5 000 non dépensés), crafts par rareté.
- Santé : % de signalements, remboursements (< 2 %), taux d'opt-in aux notifications (cible > 55 %).

### 6.4 Plan d'A/B tests sur les prix

On compare les prix **entre vitrines ou cohortes**, jamais deux prix au même moment pour un même joueur.
RevenueCat Experiments ou des *offerings* par cohorte.

1. **T1 (v1.1 + 4 semaines)** : mensuel 4,99 € contre 5,99 €, annuel fixe à 39,99 €. Critère : revenu net par visiteur du paywall à J30.
2. **T2** : annuel 34,99 € contre 39,99 € contre 44,99 €.
3. **T3** : essai de 7 jours contre 3 jours contre pas d'essai sur l'annuel.
4. **T4** : placement du paywall (J3 contre 6e booster contre fin du 1er passe gratuit).
5. **T5 (v1.2)** : passe de saison seul à 7,99 € proposé aux « refuseurs », contre rien.

Durée minimale de 2 semaines et ~1 000 vues de paywall par bras. Arrêt si le J7 baisse de plus d'un point.

---

## 7. Paiements : recommandation technique

### 7.1 RevenueCat ou StoreKit 2 en direct

| Critère | RevenueCat (`react-native-purchases`) | `expo-iap` (StoreKit 2 / Play Billing) + serveur maison |
|---|---|---|
| Intégration Expo (dev build) | Plugin de config, bien documenté [32] | Bonne : `expo-iap` est le successeur maintenu de `react-native-iap` [32] |
| Validation serveur | Faite par RevenueCat, plus un webhook vers nous | À coder : App Store Server API, JWS, App Store Server Notifications V2 |
| Multi-plateforme (Android plus tard) | Gratuit | Double travail (Play Developer API, RTDN) |
| Paywall, expériences, métriques | Inclus | À construire |
| Coût | Gratuit jusqu'à 2 500 $ de MTR par mois, puis **1 % du revenu brut** [33] | 0 € mais ~3–4 semaines de plus et de la maintenance |
| Dépendance | Un tiers sur le chemin de l'achat (mais StoreKit reste la source) | Aucune |

**Choix : RevenueCat** (D8). Pour un développeur seul, le temps gagné et la couverture des cas limites (renouvellements,
délais de grâce, *billing retry*, remboursements, Family Sharing) valent largement 1 %. On garde **notre propre table
des droits**, ce qui permet de migrer plus tard si le volume le justifie.

### 7.2 Architecture

```
App (react-native-purchases, appUserID = notre user UUID)
   │ achat StoreKit 2
   ▼
App Store ──► RevenueCat ──webhook (Authorization: Bearer <secret>)──► POST /api/v1/billing/revenuecat
                                                                         │ idempotent (event.id)
                                                                         ▼
                                                     tables entitlements, store_transactions, wallet (Sceaux)
App ──GET /api/v1/me──► l'API renvoie entitlements et avantages effectifs (selon le pays de la vitrine)
```

- **Identité** : `Purchases.logIn(userId)` après l'authentification (JWT existant). L'`appUserID` RevenueCat est notre UUID, donc pas d'utilisateurs anonymes à fusionner.
- **Webhook** : on vérifie le secret d'en-tête, on stocke l'événement brut (`billing_events`, unique sur `event.id`), puis on traite `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION` (renouvellement automatique coupé, accès gardé jusqu'à `expiration_at`), `EXPIRATION`, `BILLING_ISSUE` (délai de grâce de 16 jours activé dans App Store Connect : l'accès est maintenu), `PRODUCT_CHANGE` (mensuel ↔ annuel), `NON_RENEWING_PURCHASE` (Sceaux, Pack Fondateur), `REFUND`, `TRANSFER`. En cas de doute, on relit l'état via l'API REST RevenueCat (`GET /subscribers/{id}`) : le webhook déclenche la relecture, l'état vient de la relecture.
- **Consommables (Sceaux)** : crédités **une seule fois** par `transaction_id` (contrainte unique dans `store_transactions`), dans la même transaction SQL que le wallet. Sur un `REFUND` de Sceaux, on débite. Si le solde devient négatif, les achats de Sceaux sont bloqués jusqu'à régularisation, mais **on ne retire pas de cosmétiques déjà débloqués** : on journalise et on alerte au-delà de 2 remboursements.
- **Restauration** : bouton « Restaurer mes achats » dans Réglages et sur le paywall (`Purchases.restorePurchases()`). Il est **obligatoire** pour l'abonnement et les non-consommables. Les Sceaux étant liés au compte serveur, ils se retrouvent avec la connexion.
- **Family Sharing** : **désactivé** pour l'abonnement en v1 (les avantages sont attachés à un compte joueur, et partager des boosters entre comptes favorise le multicompte). À annoncer sur la fiche.
- **Sandbox et tests** : environnement Sandbox App Store avec renouvellements accélérés, testeurs sandbox, un fichier de configuration StoreKit local pour les tests unitaires de l'app, et un projet RevenueCat « sandbox » qui envoie ses webhooks vers l'environnement de staging. Champ `environment` stocké, et les événements sandbox ne sont **jamais** appliqués en production.

### 7.3 Ce que ça change dans l'API

**Migration `V90__create_billing.sql`** :

```sql
create table entitlements (
  user_id uuid not null references users(id),
  entitlement text not null,                -- 'premium'
  source text not null,                     -- 'app_store' | 'play_store' | 'promo'
  product_id text,
  original_transaction_id text,
  storefront_country char(3),               -- 'FRA', 'BEL'…
  status text not null,                     -- active | grace | cancelled | expired | refunded
  expires_at timestamptz,
  environment text not null default 'production',
  updated_at timestamptz not null,
  primary key (user_id, entitlement)
);
create table store_transactions (
  transaction_id text primary key, user_id uuid not null, product_id text not null,
  kind text not null, quantity int not null, refunded_at timestamptz, created_at timestamptz not null
);
create table billing_events (id text primary key, type text not null, payload jsonb not null, received_at timestamptz not null);
alter table pack_states add column premium_packs_anchor timestamptz;
alter table users add column sceaux int not null default 0;   -- à côté de l'Influence et des boosters bonus (wallet partagé, V2) ; mouvements dans wallet_ledger
```

**Minuteur de boosters selon les droits** : on garde `FreePackTimer` tel quel pour la jauge gratuite et on le
généralise en `PackGauge(interval, maxStock)` :

- `FREE = PackGauge(12 h, 2)`, `PREMIUM_RESERVE = PackGauge(12 h, 2)`, avec une ancre distincte (`premium_packs_anchor`).
- `PackService.consumeOneBooster` consomme dans l'ordre : jauge gratuite, puis Réserve Premium (si le droit est actif et la vitrine éligible), puis boosters bonus.
- **Activation** : `premium_packs_anchor = PackGauge.initialAnchor(now)`, donc 2 boosters immédiats (« l'effet waouh » du 1er jour).
- **Expiration** : la Réserve ne se remplit plus (l'ancre est gelée), et les boosters déjà accumulés restent ouvrables 48 h. Ce sont des boosters « gagnés », pas question de les reprendre brutalement.
- **BE/NL** : la Réserve est désactivée, et une tâche quotidienne crédite +120 Influence au 1er booster ouvert du jour, plus 1 craft par semaine.
- `PacksResponse` ajoute `premiumPacks: { available, nextAt, eligible }` (OpenAPI → `npm run api:gen`).

**Autres impacts** :

- `SeasonPassService` : ajout de la piste `premium`. `ClaimResponse` prend un paramètre `track` ; la réclamation de la piste Premium vérifie le droit, et les paliers restent réclamables rétroactivement.
- `WalletService` : un solde `sceaux` séparé, avec les sources `IAP`, `REFUND` et `SHOP`.
- Un nouveau module `billing/` (contrôleur webhook, service des droits, client REST RevenueCat) et un module `shop/` (catalogue cosmétique piloté par des données, achats idempotents avec `Idempotency-Key`, comme pour les boosters).
- `GET /api/v1/me` expose `entitlements` et `perks`. **Le client n'en déduit jamais un avantage par lui-même.**
- Les tests : les mêmes tests statistiques des cotes s'appliquent aux boosters de la Réserve, avec des tests de transitions de droits (actif → grâce → expiré → réactivé) et de l'idempotence des webhooks.

---

## 8. Risques (honnêtement)

| Risque | Probabilité | Impact | Atténuation |
|---|---|---|---|
| Plainte d'une personnalité vivante (image, nom) | Moyenne | Fort | Avis d'avocat ⚖️, ton neutre, pas de figure vivante dans le marketing ni les cosmétiques, retrait sur demande |
| Requalification « jeu de hasard » (Réserve Premium = objets aléatoires payants) | Faible en FR, réelle en BE/NL | Fort | Pas de vente de boosters, Réserve neutralisée en BE/NL, cotes visibles, objets non cessibles |
| Rejet de la review Apple (paywall, 3.1.2, contenu sensible) | Moyenne | Moyen | Paywall conforme, cotes depuis le paywall, notes de review qui expliquent le traitement des figures sensibles |
| Image « gamification de dictateurs » | Moyenne | Fort | Cartes sensibles désaturées, jamais monétisées ni mises en avant, bios explicites (déjà fait) |
| Acquisition payante bloquée (pubs politiques) | Forte | Moyen | Organique, éducation (enseignants), presse, créatifs sans figures vivantes |
| Économie trop généreuse, revenus faibles | Moyenne | Moyen | Notre valeur est la confiance, la monétisation passe par l'abonnement de confort et les cosmétiques. On suit l'inflation d'Influence |
| DFA plus dur que prévu (interdiction des objets aléatoires payants) | Faible avant 2028 | Moyen | La Réserve peut basculer partout vers le modèle BE/NL en une configuration serveur |
| Fraude (multicomptes, échanges) | Moyenne | Faible à moyen | Garde-fous de la section 5.6, Family Sharing désactivé, plafonds |

---

## Sources

1. Toy-People, d'après Sensor Tower : Pocket, 1 an, > 1,2 Md$ et 90 M de téléchargements — https://www.toy-people.com/en/?p=106937
2. Sensor Tower, « Pokémon TCG Pocket 100 million downloads » — https://sensortower.com/blog/pokemon-tcg-pocket-100-million-downloads
3. Pokemon-Zone, « Premium Pass in TCG Pocket » — https://pokemon-zone.com/articles/premium-pass
4. Deltia's Gaming, « Should You Buy Premium Pass » — https://deltiasgaming.com/?p=69866
5. PokemonGoHub, mises à jour mensuelles du Premium Pass 2025 — https://pokemongohub.net/post/tcg-pocket/pokemon-tcg-pocket-october-2025-premium-pass-and-missions-lineup/
6. VGC, « Pokemon TCG Pocket's Trading feature is changing after fan backlash » — https://videogameschronicle.com/news/pokemon-tcg-pockets-trading-feature-is-changing-after-fan-backlash ; Pocket Tactics — https://www.pockettactics.com/pokemon-tcg-pocket/trade-update
7. Marvel Snap, prix du passe : Prima Games — https://primagames.com/tips/is-marvel-snap-premium-worth-it-answered ; Ginx — https://www.ginx.tv/en/premium-season-pass-worth-it
8. PocketGamer.biz, « Marvel Snap surpasses $275 million » — https://pocketgamer.biz/marvel-snap-surpasses-275-million-as-it-celebrates-second-anniversary ; Game World Observer (Hearthstone 2023) — https://gameworldobserver.com/2023/08/30/marvel-snap-revenue-100-million-mobile-downloads-appmagic
9. Supercell, « Pass Royale price changes » — https://supercell.com/en/games/clashroyale/blog/news/pass-royale-price-changes-2/ ; Pocket Gamer — https://www.pocketgamer.com/clash-royale/pass-royale-changes
10. Duolingo, 10-Q T2 2026 — https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053603/duol-20260630.htm
11. Apple, App Store Small Business Program — https://www.businesswire.com/news/home/20201118005376/en/Apple-Announces-App-Store-Small-Business-Program
12. Apple, App Store Review Guidelines (3.1.1, 3.1.2(a), 5.1.1, 1.1) — https://developer.apple.com/app-store/review/guidelines/
13. PocketGamer.biz, « Pokémon TCG Pocket smashes $400 million in 10 weeks » — https://www.pocketgamer.biz/pokemon-trading-card-game-pocket-smashes-400-million-in-10-weeks ; WN Hub (> 200 M$ le 1er mois) — https://wnhub.io/news/finance/item-46390 ; Bulbagarden (DeNA −33,2 %, MAU 39 M → 23 M) — https://www.bulbagarden.net/threads/dena-reports-decreased-revenue-and-profit-in-game-business-due-to-pokemon-tcg-pockets-declining-monthly-active-users.311263/ ; Wargamer — https://www.wargamer.com/pokemon-trading-card-game/pocket-losing-players ; Kotaku (Pack Points) — https://kotaku.com/pokemon-tcg-pocket-dena-players-trading-hourglass-pull-rates-2000722438
14. TechPowerUp (analyse « 1 843 jours ») — https://www.techpowerup.com/forums/threads/328516 ; ComicBook, « cash grab complaints » — https://comicbook.com/gaming/news/pokemon-tcg-pocket-cash-grab-complaints/
15. Réseau CPC, « Key principles on in-game virtual currencies » (21/03/2025) — https://esportslegal.news/wp-content/uploads/2025/03/Key-principles-on-in-game-virtual-currencies.pdf ; Baker McKenzie — https://connectontech.bakermckenzie.com/european-consumer-protection-network-issues-new-key-principles-on-in-game-virtual-currencies-impact-for-gaming-and-gambling-entities-in-belgium-the-eu-and-beyond/
16. PEGI, « Paid Random Items » — https://pegi.info/bg/node/67 ; Fieldfisher — https://fieldfisher.com/en/services/technology-and-data/technology-law-blog/european-ratings-board-introduces-paid-random-item
17. Gamewave, « Pokémon Pocket indisponible en Belgique » — https://gamewave.fr/pokemon-pocket/pokemon-pocket-indisponible-en-belgique-a-cause-d-un-detail/ ; Gamereactor (UNITE BE/NL) — https://www.gamereactor.eu/pokemon-unite-is-being-delisted-in-belgium-and-the-netherlands-due-to-loot-boxes-1439143/
18. Public Gaming, « Belgium defines video game loot boxes as illegal gambling » — https://publicgaming.com/news-categories-m/legal/2875-belgium-defines-video-game-loot-boxes-as-illegal-gambling ; Clifford Chance (Pays-Bas) — https://cliffordchance.com/insights/resources/blogs/talking-tech/en/articles/2022/09/the-ultimate-loot-drop-the-netherlands-is-planning-to-ban-loot.html
19. Brésil, ECA Digital : Mattos Filho — https://www.mattosfilho.com.br/en/unico/brazils-eca-digital/ ; Demarest — https://www.demarest.com.br/en/eca-digital-nova-lei-de-protecao-de-criancas-e-adolescentes-no-ambiente-digital/
20. Freshfields, « The EU's proposed Digital Fairness Act: a game developer's guide » — https://technologyquotient.freshfields.com/post/102ltio/the-eus-proposed-digital-fairness-act-a-game-developers-guide-to-potential-imp ; EU Perspectives — https://euperspectives.eu/2025/11/developers-push-back-the-digital-fairness-act/
21. Apple, nouvelles classifications d'âge (juillet 2025) — https://www.iphoneincanada.ca/2025/07/25/updated-app-store-age-ratings
22. Fenwick, « Google Play Now Requires Disclosure of Loot Box Odds » — https://www.fenwick.com/insights/publications/google-play-now-requires-disclosure-of-loot-box-odds
23. L. Xiao, « Loot boxes remain prevalent in Belgium despite their ban » — https://rr.peercommunityin.org/articles/rec?id=264 ; MCV — https://www.mcvuk.com/business-news/belgium-isnt-enforcing-loot-box-ban-claims-research-study/
24. iGaming Business, « Weerwind floats possible Dutch loot box ban » — https://igamingbusiness.com/legal-compliance/weerwind-floats-possible-dutch-loot-box-ban
25. Bird & Bird, « Loi SREN : nouveau régime des JONUM » — https://cm.twobirds.com/en/insights/2025/france/loi-sren-nouvelle-definition-et-nouveau-regime-pour-les-jeux-a-objets-numeriques-monetisables-jonum
26. iGaming Business, « France operationalises JONUM regime » — https://igamingbusiness.com/legal-compliance/france-operationalises-jonum-regime/ ; Sumsub (février 2026) — https://sumsub.com/media/news/france-launches-new-regulatory-regime-for-monetizable-digital-object-games/
27. Digital Fairness Act, calendrier — https://digital-fairness-act.eu/timeline/ ; Wikipédia — https://en.wikipedia.org/wiki/Digital_Fairness_Act
28. PocketGamer.biz, « Australia sets new rules for video games with gambling-like content » — https://www.pocketgamer.biz/australia-sets-new-rules-for-video-games-with-gambling-like-content
29. TechCrunch, « Meta to stop selling political ads in the EU from October » — https://techcrunch.com/2025/07/25/meta-to-stop-selling-political-ads-in-the-eu-from-october ; The Register — https://www.theregister.com/2025/07/25/meta_eu_political_ads/
30. Meta, « Ads about Social Issues, Elections or Politics » — https://transparency.meta.com/policies/ad-standards/SIEP-advertising/SIEP/
31. GameAnalytics, benchmarks mobiles 2025/2026 — https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game ; https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks
32. Expo, « In-app purchases » — https://docs.expo.dev/guides/in-app-purchases/ ; expo-iap — https://npmjs.com/package/expo-iap
33. RevenueCat, gestion de compte et tarifs — https://www.revenuecat.com/docs/welcome/set-up-revenuecat/account-management
