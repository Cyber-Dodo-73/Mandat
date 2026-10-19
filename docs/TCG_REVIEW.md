# MANDAT — Revue d'un game designer TCG

Version du 2026-10-19 (build TestFlight 0.1.0 (12), commit `5d0f367`). Revue en lecture seule : aucun code n'a été modifié.

Ce que j'ai lu : `docs/BUSINESS.md`, `docs/DEVIATIONS.md`, `docs/ART_PROMPTS.md`, `data/content/GUIDELINES.md`, `data/cards.season1.json`
(500 cartes, dont un échantillon de 45 lu ligne à ligne), `data/firstPackRules.json`, les règles de l'API (`pack/draw`, `collection`,
`progression`, `quiz`, `duel`, `profile`, `social`) et les écrans mobiles (`packs`, `collection`, `missions`, `profile`, `duel`, `quiz`,
`onboarding`). J'ai aussi regardé les 9 captures TestFlight et le scénario `rebalanced` en cours dans la worktree `agent-adfe6fc7…`
(`scripts/economy/simulate.py`). J'ai lancé `simulate.py --runs 50`, plus une simulation de duel faite à part (méthode en annexe A).

Légende : **P0** à corriger avant le lancement public · **P1** dans le mois qui suit · **P2** dans les 3 mois.
L'effort est en **jours-développeur** (j) pour un développeur full-stack seul, contenu compris quand c'est précisé.

---

## Synthèse en 12 lignes

1. **Le rituel de base est bon.** Booster qu'on déchire au doigt avec retour haptique, révélation carte par carte de la moins rare à la plus rare, dos de carte qui brille pour une rare+, cotes publiées, pity serveur, premier booster composé. C'est le niveau de TCG Pocket sur le principe.
2. **Il y a deux failles d'économie à fermer avant tout.** Le quiz et les duels n'ont **aucun plafond quotidien de récompenses** : on farme un booster tous les 5 quiz parfaits et jusqu'à 35 Influence par duel, sans limite. La simulation suppose 1 quiz et 3 duels par jour, ce qui n'est pas la réalité du code.
3. **Les figures sensibles sont au cœur de la chasse aux cartes.** **Hitler et Staline font 2 des 10 mythiques**, soit 20 % des tirages mythiques. Goebbels est épique, Eichmann, Göring et al-Baghdadi sont rares. Ils peuvent sortir en finition **or** (Hitler or = 4 000 Influence au recyclage, l'objet le plus rentable du jeu), l'IA peut les jouer contre vous, et ils comptent dans le 100 %. Pour un store comme pour la presse, c'est le risque n° 1, devant les loot boxes.
4. **La rareté reflète la notoriété sur Wikipédia anglophone, avec un biais occidental marqué.** L'Afrique a 56 communes pour 1 épique, 1 légendaire et 1 mythique. L'Amérique du Sud a 69 communes et **aucune** peu commune, légendaire ou mythique. L'Océanie a 14 communes et 1 rare. Sankara, Allende et Perón sont communs, Lumumba peu commun. Pour un jeu qui vise l'Afrique francophone, c'est un problème d'image.
5. **En duel, les cartes rares sont les plus faibles.** Taux de victoire par manche contre une carte au hasard : **communes 54 %, mythiques 37 %** (annexe A). La règle « l'outsider gagne les égalités », les capacités « si la carte adverse est plus rare » et des totaux de stats tirés au hasard (Poutine et Churchill à 15/40) font qu'une mythique est une mauvaise carte. Un joueur qui vient de tirer sa mythique et perd avec, c'est une expérience négative mémorable.
6. **Le duel est trop superficiel pour tenir dans la durée.** Les capacités ne s'activent que dans **23 % des manches** et ne changent l'issue que dans ~14 % des cas. L'IA compose son équipe autour de la moyenne de stats du joueur (`DuelAi.pickTeam`), donc **votre collection ne compte pas** en duel. Il n'y a ni deck, ni PvP, ni classement.
7. **La méta de collection n'existe pas encore.** Pas d'albums, de récompenses de complétion, d'échanges, de dons, de liste de souhaits, ni de Pioche diplomatique. Il n'y a que des barres par continent et par époque. Or c'est ce qui fait revenir chez TCGP et chez Panini.
8. **Le retune prévu (`rebalanced`) va trop loin sur les doublons.** Une commune se crafte 250 et se recycle 3, soit un ratio de **1:83** (Hearthstone : 1:8 pour une commune, 1:4 pour une légendaire), et le bonus doublon d'une commune passe à 0. Les doublons ne vaudront plus rien. Il faut viser ~1 craft tous les 2 jours en baissant les **sources hors recyclage**, pas en écrasant la valeur du recyclage.
9. **Une seule extension de 500 cartes**, toutes au même niveau, sans sous-thèmes, sans numérotation de chase au-delà de 500 (pas de « secret rares »), avec 68 % de figures contemporaines (33 antiques, 19 médiévales). Il manque des incontournables pour un public français : Mitterrand, Jeanne d'Arc, Clemenceau, Simone Veil, Toussaint Louverture, Senghor. On trouve en revanche 13 Péruviens, dont Vizcarra et Kuczynski.
10. **Les finitions holo et full art écrasent la photo** (arc-en-ciel posé sur le visage, captures 4 et 6). Les drapeaux sont dessinés en 3 bandes verticales (`flagColors.ts`), si bien que l'Ouganda ressemble à la Belgique et l'Allemagne serait fausse. Pour un jeu « histoire et culture », ça entame la crédibilité.
11. **Le modèle de monétisation est sain et défendable** (pas de booster payant, une seule monnaie, abonnement de confort). Mais les deux leviers qui font payer les joueurs de TCG, **la chasse premium (alt-arts, illustrations) et l'expression de soi (vitrine, album, profil)**, sont encore à construire. Sans eux, les Sceaux n'auront pas grand-chose à vendre.
12. **UX** : de bonnes bases (TopBar, figure du jour, profil et vitrine), mais il y a des états morts (« Aucun booster gratuit » avec un bouton grisé et rien d'autre à faire), des libellés tronqués, une collection qui s'ouvre sur des cases noires, une montée de niveau illisible au-dessus d'un toast, et un passe de saison qui ne montre qu'un palier.

---

## Liste P0 (avant le lancement public)

| # | Problème | Correctif | Effort |
|---|---|---|---|
| P0-1 | **Quiz et duels sans plafond de récompenses** (`QuizService.start`, `DuelService.playRound`, `QuizRules.PERFECT_QUIZZES_PER_BOOSTER`) : on farme des boosters et de l'Influence à l'infini, et un bot aussi. | Récompenses quotidiennes plafonnées côté serveur : **3 quiz récompensés par jour** (le booster « 5 parfaits » ne compte que ceux-là) et **5 victoires de duel récompensées par jour**. Au-delà, on peut rejouer pour l'XP réduite ou pour le plaisir. Le plafond et un compteur s'affichent dans l'UI (« 2/3 quiz récompensés aujourd'hui »). Ajouter les tests. | 1,5 j |
| P0-2 | **Figures sensibles dans la chasse** : Hitler et Staline mythiques, Goebbels épique, Eichmann, Göring, Hess, al-Baghdadi en rares et peu communes ; finitions holo et or possibles (`DrawEngine.rollFinish` ne les exclut pas) ; utilisées par l'IA (`DuelAi.pickTeam` prend tout `activeCards`) ; comptées dans les succès et le %. | (a) **Sortir les sensibles de l'échelle de rareté** : une catégorie à part, « Archives », avec un liseré gris et sans gemme de rareté, en emplacement normal (jamais en emplacement 5, jamais « hit »). (b) **Finition forcée `standard`** côté serveur, sans holo, or ni full art. (c) Exclues des équipes de l'IA, de la vitrine, de la carte favorite et du partage. (d) Pas comptées dans les succès de rareté ni dans le % principal (un compteur « Archives » séparé). (e) **Retirer les exécutants sans fonction d'État** (Eichmann, al-Baghdadi, Guzmán) : ce ne sont pas des « figures politiques », et ce sont eux qui feront la une. Le mythique laissé vacant est remplacé (Mandela ou de Gaulle remontent). Mettre `GUIDELINES.md` et `DEVIATIONS.md` à jour. | 3 j + contenu |
| P0-3 | **Figures vivantes au cœur d'un conflit en cours** : Poutine mythique avec une capacité « Verticale du pouvoir », Zelensky légendaire, Netanyahou et d'autres à vérifier. Règle App Store 1.1.7 et droit à l'image (BUSINESS §4.4). | Décision produit et avis d'avocat **avant la soumission publique**, pas seulement avant les paiements. Option la plus sûre : les dirigeants en exercice d'un pays en guerre active ne sont pas des « hits » (plafond à rare), et leur capacité a un nom neutre (« Président de la Russie depuis 2000 », pas un slogan). | 1 j + juridique |
| P0-4 | **Le retune `rebalanced` détruit la valeur des doublons** (ratio recyclage/craft de 1:83 sur les communes, bonus doublon à 0). | Garder le recyclage à ~1:8–1:12 et baisser **les sources** : missions ×0,3, niveaux, quiz, duels (ce que fait déjà le scénario), achats d'Influence par les succès. Grille proposée en §3.4. | 1 j (sim + `EconomyRules`) |
| P0-5 | **Une mythique perd plus qu'une commune** (37 % contre 54 %) et une capacité mythique est **morte** : Gandhi a « −3 si la carte adverse est plus rare », or rien n'est plus rare qu'une mythique. Cinq légendaires ont la même condition et ne s'activent que contre les 10 mythiques. | Correction minimale avant le lancement : (1) remplacer `opponentRarityHigher` sur les légendaires et mythiques (validateur de build) ; (2) **plancher de stats par rareté** pour l'emplacement 5 (épique ≥ 22, légendaire ≥ 24, mythique ≥ 26) : on garde la décorrélation entre communes et rares, mais un « hit » n'est jamais une mauvaise carte ; (3) supprimer la règle de l'outsider à l'égalité, ou la limiter aux écarts de 2 raretés et plus. Refonte plus profonde en P1 (§4). | 2 j + contenu |
| P0-6 | **Drapeaux faux** (3 bandes verticales pour tous les pays, `flagColors.ts`) : Ouganda = Belgique, Allemagne verticale, etc. | Un jeu de drapeaux SVG sous licence libre (par ex. `flag-icons`, MIT) pour les États actuels, et un emblème neutre pour les États historiques (`historic-states.json`). | 1 j |
| P0-7 | **Le premier booster n'a pas de moment « wow » garanti** : l'épique+ est en position 0 (`tryFirstPack`), le full art n'est possible que sur le dernier emplacement qui est une commune, donc impossible ; aucune finition garantie. | Mettre la carte épique+ au dernier emplacement, avec une **finition holo garantie** dans le premier booster, et une **légendaire garantie dans les 3 premiers boosters** (un pity de tutoriel). Le joueur repart avec une vraie belle carte en moins de 2 minutes. | 0,5 j |
| P0-8 | **État mort sur l'accueil** (capture 2) : jauge vide, « OUVRIR » grisé, aucune autre action proposée. | Quand la jauge est vide, le gros bouton devient l'action suivante la plus utile : « Quiz du jour : +1 booster en jeu » si le prochain booster de quiz est proche, sinon « 3 missions à finir » ou « Duel ». La jauge reste visible en petit. Règle : **toujours une action principale disponible**. | 1 j |

Total P0 : ~11 jours de dev, plus le contenu (remplacement de ~5 figures, révision de ~20 capacités) et une consultation juridique.

---

## 1. Fantasme central et identité

### Ce qui marche
- **« Tiens, j'ai tiré Cléopâtre »** est un fantasme immédiat et universel. Tout le monde a une opinion sur les figures, ce qui donne une conversation sociale gratuite que Pokémon n'a pas.
- **Bios factuelles et neutres** (`GUIDELINES.md`), crédits photo, numérotation `384/500` visible sur la carte : c'est sérieux et ça collectionne bien.
- **Les vraies photos** (Wikimedia) donnent de l'authenticité et coûtent zéro en production. Les portraits peints anciens (Louis XIV, Henri V) sont superbes.

### Ce qui ne marche pas
1. **La rareté n'a pas de fiction.** Elle sort d'un `fameScore` (pages vues sur en.wikipedia et nombre de sitelinks). Le joueur ne comprend pas pourquoi Juan Guaidó est commun et Kamala Harris légendaire. Dans un TCG, la rareté doit **se lire** : Pokémon (évolutions, légendaires), Snap (séries), FUT (note globale, carte TOTW). Proposition : nommer les raretés par des **sceaux** : Bronze, Argent, Or, Pourpre, Impérial, avec une ligne d'aide « La rareté reflète la notoriété mondiale de la figure aujourd'hui ». Ce **disclaimer** est important : il désamorce le « vous dites que Sankara vaut moins que Boris Johnson ».
2. **Biais régional** (voir la synthèse). Correctif P1 : un **plafond de rareté par continent** en plus du plafond par pays (`DEVIATIONS.md`), par exemple au moins 1 mythique et 3 légendaires par continent hors Océanie, et le reclassement de figures historiques fortes : Bolívar, Mandela, Haïlé Sélassié, Nkrumah, Sankara, Toussaint Louverture (absent), Atahualpa ou Pachacutec, Moctezuma, Mansa Moussa, Soundiata (à vérifier). C'est un **choix éditorial assumé**, pas un algorithme. Effort : 2 j + contenu.
3. **Trop contemporain, et des cartes de remplissage.** 341 cartes contemporaines sur 500, 89 communes vivantes, des séries de présidents péruviens. Les communes doivent aussi faire envie. Pistes : Antiquité et Moyen Âge à ≥ 20 % en saison 2 (Hammourabi, Ashoka, Périclès, Aliénor d'Aquitaine, Saladin, Wu Zetian, Soundiata…). Pour les figures françaises absentes, prévoir un **mini-set « Promo FR »** au lancement (Jeanne d'Arc, Clemenceau, Jaurès, Simone Veil, Mitterrand, Toussaint Louverture, Senghor, Houphouët-Boigny). Effort : 3 j de contenu.
4. **Pas de « chase » au-delà du set.** Chez TCGP, la vraie chasse, ce sont les **immersives, full arts et alt-arts** (star / crown rares). Ici, le full art est un traitement de couleur sur la même photo. Proposition :
   - **Secret rares numérotées au-delà de 500** (`501/500` à `520/500`) : 20 cartes « Moments » illustrées (la poignée de main Rabin-Arafat, l'appel du 18 Juin, la chute du Mur, « I have a dream »). Ce sont des événements et non des personnes, ce qui règle aussi une bonne partie du droit à l'image.
   - **Alt-arts illustrés** pour les ~40 cartes épique+ non sensibles (`ART_PROMPTS.md` §7 existe déjà) : style gravure, mosaïque romaine, affiche constructiviste ou pop art selon l'époque.
   - **Finition or animée** réservée aux légendaires et mythiques. Une commune or à 0,3 % vaut moins qu'une épique holo dans la tête du joueur, et c'est bien. Mais un « or » doit être visuellement à part, comme une **carte métallique** avec la signature en relief.
5. **Holo mal appliqué.** Sur les captures 4 et 6, l'arc-en-ciel recouvre le visage. La règle des cartes physiques est simple : **le foil va sur le cadre et le fond, jamais sur le visage** (masque du sujet ; les portraits sont déjà détourés ou détourables avec un masque de saillance). P1, 2 j.
6. **L'identité visuelle des raretés est faible sur la carte.** Une petite gemme et des losanges en bas à gauche, un liseré de couleur. Proposition : **cadre de rareté** fort (bronze, argent, or, pourpre, impérial avec laurier), **gemme en haut à droite** lisible en vignette de collection, et un fond de carte propre à l'époque (papyrus, enluminure, gravure, photo de presse). Pour l'onboarding, une carte « Comment lire une carte ».

### Figures sensibles : point de vue du joueur et du store
- Côté joueur, le **plaisir du hit** est incompatible avec « j'ai tiré Hitler ». Désaturer la carte ne règle rien : c'est l'événement (la mythique, l'animation, le son légendaire) qui pose problème. Elles doivent donc **sortir de la boucle de récompense** (P0-2).
- Leur garder une place a du sens, puisque c'est un jeu d'histoire. Je propose un **« Fonds d'archives »** consultable dans la collection, débloqué par le quiz (« Réponds à 3 questions sur la Seconde Guerre mondiale pour ouvrir le dossier »), sans stats ni capacité de duel, avec seulement la bio et la chronologie. C'est le format musée, et il est défendable devant Apple et la presse.
- **Les capacités des sensibles doivent disparaître.** « Guerre totale » sur Hitler ou « Règne de la terreur » sur al-Baghdadi transforment un crime en mécanique de jeu. Le titre de presse est tout trouvé.
- Checklist store : captures App Store sans aucune sensible ni figure vivante, classification 13+ ou 16+ (le questionnaire 2026 a 16+, à considérer à cause des génocides décrits), mention « contenu historique » dans la description, et un **signalement par carte** (aujourd'hui seuls les profils sont signalables, `ReportService`).

---

## 2. Ouverture de boosters

### Ce qui marche
- Déchirer au doigt avec retour haptique, le son `tear`, le booster qui suit l'inclinaison du téléphone, la requête lancée pendant que le booster flotte (pas d'attente). C'est **meilleur que TCGP sur la gestuelle**.
- Révélation dans l'ordre croissant de rareté (`revealOrder`), dos qui brille pour une rare+ (`hintRarity`), « premier de cette rareté » mémorisé : de bons choix.
- Cotes publiques (`GET /packs/{id}/odds`, `OddsSheet`), pity serveur (10 / 40), idempotence de l'ouverture.

### Ce qui ne marche pas, ou manque
| Sujet | Constat | Recommandation | Prio | Effort |
|---|---|---|---|---|
| Suspense | Toutes les cartes sont traitées pareil : tap, révélation, tap. Il n'y a pas de pause ni de montée. | **Escalade** : communes en rafale (on peut swiper les 4 premières d'un coup, comme TCGP qui les révèle presque ensemble), puis **arrêt sur la carte 5** avec un dos qui change de couleur selon la rareté (bronze, argent, or, pourpre, impérial), un « hold to reveal » de 0,8 s et un son qui monte. Pour une légendaire ou une mythique : écran noir, plein écran, lumière, nom de la figure en grand et une **citation** de la figure. | P1 | 3 j |
| God pack | Absent. | Un **« Booster d'État »** à ~0,05 % : 5 cartes rare+ dont au moins 1 légendaire, avec un booster doré qu'on voit **avant** de le déchirer (TCGP montre la rareté du pack à l'ouverture). C'est l'histoire que les joueurs racontent sur Reddit et TikTok. Probabilité affichée dans les cotes. | P1 | 1,5 j |
| Pity visible | `PityDto` existe, mais rien n'est affiché sur l'accueil ou le booster (BUSINESS §5.3). | Deux petites jauges sous le booster : « Épique garantie dans 7 », « Légendaire garantie dans 33 ». C'est rassurant et ça donne un horizon. | **Quick win** | 0,5 j |
| Points de booster | Pas d'équivalent des Pack Points de TCGP. L'Influence en tient lieu, mais elle vient surtout du recyclage. | **+5 « Voix » par booster ouvert** (non recyclables), échangeables contre **une carte précise** au même barème que TCGP (35 / 70 / 150 / 500 / 1 250 / 2 500). C'est une garantie déterministe, lisible, indépendante des doublons. Elle peut remplacer une partie du craft par Influence dans le retune. | P1 | 2 j |
| Doublons | Le récapitulatif montre « +X Influence ». C'est sec. | Animation de la carte doublon qui **se fond en jetons** vers le compteur d'Influence ; un doublon d'une carte holo ou or est mis en avant (« Tu avais déjà la standard, voici la holo ! » : une **nouvelle finition = nouvelle carte**, badge « Nouvelle finition »). | P1 | 1 j |
| Wonder Pick | Prévu (« Pioche diplomatique », BUSINESS §5.6), pas fait. | C'est le **moteur social n° 1 de TCGP**. À faire en v1.1, avant les échanges. Variante sans amis au lancement : les « boosters ouverts récemment par la communauté » (anonymisés). | P1 | 4 j |
| Boosters par continent | Débloqués aux niveaux 3 à 8, mais l'Océanie compte 15 cartes (14 communes) et l'Amérique du Sud n'a ni peu commune, ni légendaire, ni mythique. Les raretés manquantes reviennent au pool global (`CardPool.restrictedTo`), donc les cotes affichées pour un « booster Océanie » trompent sur le contenu. | Réserver les boosters thématiques aux pools de ≥ 60 cartes **avec toutes les raretés**. Sinon, des boosters **par époque** ou par **album** (« Révolutions », « Femmes d'État ») plutôt que par continent. La page de cotes doit dire « emplacement 5 : tiré dans tout le set si le continent n'a pas de carte de cette rareté ». | P1 | 1 j |
| Ouvrir plusieurs boosters | Il faut tout refaire à chaque booster (« Ouvrir un autre »). | « Tout ouvrir » (×2 ou ×4 en Premium) avec un récapitulatif groupé. La gestuelle reste réservée au premier. | P2 | 1,5 j |
| Finitions | Holo à 8 % par carte = ~0,4 holo par booster. C'est trop fréquent pour faire un « hit », pas assez pour dire « holo garanti ». | Holo à 4 % sur les emplacements 1–4 et à 15 % sur l'emplacement 5 : la holo devient une **récompense de l'emplacement 5**. | P2 | 0,5 j |

---

## 3. Méta-jeu de collection

### État des lieux
- La collection affiche le % global plus 6 continents et 4 époques (capture 9) : clair, mais l'**écran s'ouvre sur 3 cases noires** (001, 002, 003, les mythiques qu'on n'a pas). À 3,8 %, l'impression est « tout ce que je n'ai pas ».
- Vitrine de 6 cartes plus une carte favorite (capture 4) : bien, c'est la base de l'expression de soi.
- Craft et recyclage existent. Il n'y a ni albums, ni récompenses de complétion, ni échanges, ni dons, ni liste de souhaits.

### Recommandations
1. **Albums thématiques (P1, 4 j + contenu)** : c'est le **cœur Panini**. Un album = 9 à 24 cartes, une page avec des emplacements numérotés, la silhouette et le **nom visibles** des cartes manquantes (Panini montre le nom de la vignette manquante, et c'est ce qui fait chercher). Récompenses : titre, cadre, Influence, et un **dos de carte** pour les albums difficiles.
   Liste de départ (calculable depuis `cards.season1.json` plus un tag éditorial) : « Pères fondateurs », « Femmes d'État », « Révolutionnaires », « Empereurs », « Décolonisation et Indépendances », « Prix Nobel de la paix », « Guerre froide », « Monarques britanniques », « Présidents de la Ve République », « Rome antique », « Dynasties » (les Kennedy, Bush, Gandhi-Nehru, Castro, Kenyatta…), « Rivaux » (paires : Kennedy et Khrouchtchev, Pompée et César…). Les **Rivaux** et les **Dynasties** sont le meilleur outil pour faire désirer une commune.
2. **Collection par défaut** : tri « possédées d'abord » ou **vue « Albums »** au premier lancement. La vue « Numéro » (le classeur 001→500) reste en option. Les cartes manquantes montrent la silhouette, le nom et le pays (pas la photo).
3. **Liste de souhaits (P1, 1 j)** : jusqu'à 5 cartes suivies, avec une notification « Une carte de ta liste est dans la Pioche d'un ami ». Plus tard, une légère pondération est envisageable, mais seulement si on l'annonce.
4. **Échanges (P1–P2)** : le plan de BUSINESS §5.6 est bon, mais **le coût en Influence plus « 1 par jour » plus « amis depuis 7 jours » plus le niveau 10** risque de répéter l'erreur de TCGP. Garder **amis + 1 par jour + rareté égale**, enlever le délai de 7 jours pour les **amis ajoutés par QR code en face à face** (les cours de récré et les classes, qui sont notre cible), et faire payer en jeton gratuit plutôt qu'en Influence.
5. **Dons (P2, 1,5 j)** : « Offrir un doublon » à un ami, communes et peu communes, 1 par jour. C'est le geste social le plus simple et il ne crée pas de marché.
6. **Défis de collection par ami** : la comparaison (`/profiles/{code}/compare`) existe déjà. Il faut la rendre visible : « Il te manque 3 cartes que Léa a en double ».

### 3.4 Économie : craft, recyclage, sources et puits
**Constat actuel (`current`)** : un F2P assidu gagne ~385 Influence/jour (141 000 par an) et finit le set en 132 jours. C'est trop généreux, mais c'est surtout le **recyclage** (42 %) et les **missions** (18 %) qui alimentent. Les quiz et duels illimités (P0-1) ne sont pas simulés et feraient exploser ces chiffres.

**Le retune visé (~1 craft tous les 2 jours pour un F2P actif)** est le bon objectif. Mais le scénario `rebalanced` en cours a trois défauts :
- **Doublons sans valeur** : recycler une commune donne 3 et la crafter coûte 250. Psychologiquement, recycler devient inutile, et c'est pourtant le seul geste qui transforme la malchance en progrès. Hearthstone : 5→40 pour une commune (1:8), 400→1 600 pour une légendaire (1:4). MTG Arena a abandonné la poussière pour des **jokers** (wildcards), justement parce que la conversion des doublons frustrait.
- **Mythique à 9 000** : 72 jours de revenus. L'écart avec la légendaire (3 500) est cohérent, mais le joueur ne verra jamais ce chiffre baisser, faute de visibilité.
- **Achievements à 2 000** : si c'est un plafond total, c'est bien.

**Grille proposée** (à valider dans `simulate.py`, objectif ~0,5 craft/jour pour un F2P assidu) :

| Rareté | Recyclage standard | Bonus doublon | Craft | Ratio | Voix (pack points) |
|---|---|---|---|---|---|
| Commune | 10 | 2 | 100 | 1:10 | 35 |
| Peu commune | 20 | 4 | 200 | 1:10 | 70 |
| Rare | 50 | 10 | 500 | 1:10 | 150 |
| Épique | 120 | 25 | 1 200 | 1:10 | 500 |
| Légendaire | 300 | 60 | 3 000 | 1:10 | 1 250 |
| Mythique | 800 | 150 | 8 000 | 1:10 | 2 500 |

Avec des sources hors recyclage divisées par ~3 (missions ×0,3, niveaux 20, quiz plafonné, duels plafonnés). Le ratio constant de 1:10 se mémorise : **« 10 doublons = 1 carte de la même rareté »**. C'est la règle Panini (« 10 doubles contre 1 manquante »), qu'on peut afficher telle quelle. Multiplicateur de finitions : holo ×2, full art ×4, **or ×5** (×10 aujourd'hui rend l'or plus rentable à détruire qu'à garder, ce qui est absurde pour l'objet le plus rare).

**Puits manquants** (aujourd'hui, l'Influence ne sert qu'au craft) :
- **Améliorer une finition** : standard → holo contre 3 exemplaires plus de l'Influence. C'est le puits de long terme idéal, purement cosmétique, et il donne une raison de garder ses doublons (P1, 2 j).
- **Crafter une finition holo** ×3 du coût standard ; full art ×8. L'or jamais : il reste le fruit de la chance.
- Changer le thème d'un booster, relancer une mission (50), billets de Pioche.
- Ne **jamais** vendre de l'Influence, ce qui est déjà la règle.

---

## 4. Gameplay

### 4.1 Duel : diagnostic
- **Structure** : on choisit 3 cartes, 3 manches au maximum, un domaine (une des 4 stats) tiré **avant** chaque manche, chacun joue une carte en aveugle, la plus haute valeur gagne. On comprend en 10 secondes, et c'est bien pour un jeu de collection. Mais :
- **Décisions pauvres** : avec 3 cartes et un domaine annoncé, le coup optimal est presque toujours évident. Le seul vrai dilemme, « je garde ma 10 en Stratégie pour plus tard ? », est neutralisé par le tirage aléatoire des domaines suivants.
- **Les capacités pèsent peu** : 79 % d'entre elles visent une stat précise, donc ne s'activent que si le domaine tombe dessus (25 %), **et** si la condition est remplie. Mesure : au moins une capacité bonus ou malus s'applique dans 23 % des manches seulement.
- **L'IA élastique** (`pickTeam` vise la moyenne de stats du joueur, ±4/+2) : progresser en collection n'apporte **rien** en duel. C'est un choix anti pay-to-win, mais il tue la motivation « je veux cette carte pour mon équipe ».
- **La rareté pénalise** (P0-5).
- **Les récompenses sont faibles et farmables** : 10 à 35 Influence, sans plafond.

### 4.2 Duel : refonte proposée (P1, ~8 j)
Objectif : 90 s par partie, une vraie décision par manche, une collection qui compte sans pay-to-win.
1. **Domaines connus à l'avance** : on annonce les 3 domaines **au début** (« Diplomatie → Stratégie → Charisme »). Le choix des cartes et leur ordre deviennent un vrai problème d'optimisation. Ou bien un mode « Sommet » où **le perdant de la manche choisit le domaine suivant**, ce qui crée de l'interaction.
2. **Équipe de 5, on en joue 3** : on construit un « Cabinet » de 5 cartes (un deck léger), et on choisit ses 3 après avoir vu les domaines. La construction de deck existe enfin, sans complexité.
3. **Synergies de cabinet** : +1 si 2 cartes du même continent ou de la même époque, +2 si une paire de « Rivaux » ou de « Dynastie » est complète. **C'est là que la collection compte**, et c'est en lien direct avec les albums.
4. **Une capacité active une fois par partie** (« Veto », « Discours », « Alliance ») en plus de la passive. Un tap, une décision.
5. **Capacités plus lisibles et plus fréquentes** : moins de « +2 en Diplomatie si adversaire même continent et manche de Diplomatie », plus de « +1 dans tout domaine si… ». Viser 50 % de manches avec un effet. Ajouter un **validateur** dans le build (`scripts/build-cards`) qui simule le taux d'activation et refuse les capacités mortes.
6. **IA** : garder le choix « attendu » de `HARD` (c'est bien fait), mais **composer les équipes de l'IA comme des decks thématiques nommés** (« Le Directoire », « Les Pharaons », « Guerre froide ») plutôt que par proximité de stats. C'est plus lisible et ça fait découvrir des cartes.
7. **Mode « Campagne »** (P2, 6 j + contenu) : 30 à 50 combats scénarisés par époque (« Rome, 44 av. J.-C. »), avec un quiz court avant chaque chapitre et des étoiles. C'est le contenu solo qui manque, et il est pédagogique.

### 4.3 PvP et classement
- **PvP asynchrone en P2** (5 j) : on affronte le **cabinet enregistré** d'un autre joueur joué par l'IA (le modèle Clash Royale / Marvel Snap des débuts). Pas de serveur temps réel.
- **Défi d'ami** (P1, 2 j) : la même chose entre amis, avec un lien partageable. C'est la boucle sociale la moins chère.
- **Ligue saisonnière** (BUSINESS §5.7) seulement après la refonte : classer un jeu à décision unique produit du hasard pur.

### 4.4 Stats décorrélées de la rareté : bonne idée, mauvaise exécution
L'idée « célèbre ≠ fort » est un **vrai argument** contre le pay-to-win. Mais un hasard pur (`statTotal` tiré d'un hash, de 14 à 30) donne des cartes **incohérentes avec la figure** (Akbar 14/40, Poutine 15, Churchill 15, Nancy Reagan 29) et frustre le collectionneur. Proposition :
- Un **total par rareté resserré** (communes 18–30, mythiques 24–28) : décorrélé dans la plage commune-rare, plancher pour les « hits ».
- **Répartition par profil éditorial** : la répartition l'est déjà (`GUIDELINES.md`), mais le **total** devrait refléter la figure à ±3 près. Un joueur doit pouvoir se dire « Napoléon, évidemment, 10 en Stratégie ».

### 4.5 Quiz
- **Points forts** : généré à partir du catalogue (vérifiable), 5 types (rôle, bio masquée, pays, plus ancien, chronologie), moitié sur les cartes possédées. C'est le bon lien collection → apprentissage.
- **Limites** : il tourne vite en rond (5 gabarits sur 500 cartes), et il n'y a ni thèmes, ni difficulté, ni explication enrichie après la réponse.
- **Ajouts** :
  - (P1, 3 j) Nouveaux gabarits : « Qui a dit… ? » (citations vérifiées), « Qui a succédé à… ? », « Associe la figure à l'événement », « Vrai ou faux », photo → nom (pas pour les sensibles).
  - (P1, 1 j) **Quiz du jour identique pour tous**, avec un classement entre amis et un résultat partageable façon Wordle (🟩🟥🟩…). C'est le meilleur levier viral pour un jeu éducatif.
  - (P2) Quiz thématiques liés aux albums et aux événements. Une **« fiche apprise »** sur chaque carte (badge « Je connais » après 3 bonnes réponses sur elle) : la collection de connaissances double la collection de cartes.
  - (P2) Un mode enseignant ou classe (code de classe, quiz commun) : c'est le canal d'acquisition organique de BUSINESS §2.7.

---

## 5. Progression et rétention

### Boucle quotidienne actuelle
Booster ×2 (12 h, stock 2), 3 missions quotidiennes plus des hebdomadaires, quiz, duel, série avec un gel hebdomadaire, niveaux (un booster tous les 2 niveaux), passe gratuit de 50 paliers, succès, figure du jour, push à distance. **La base est complète.**

### Problèmes et recommandations
| Sujet | Constat | Reco | Prio | Effort |
|---|---|---|---|---|
| Passe de saison | Fini en 21 jours (`current`). L'écran (capture 5) montre un seul palier et beaucoup de vide. Il n'y a pas de vue des deux pistes. | Appliquer 400 XP par palier (D7). **Piste horizontale** à 2 rangées (gratuite / Premium grisée) avec toutes les récompenses visibles et les « gros lots » aux paliers 10/25/50 mis en avant. **Paliers bonus** au-delà de 50 (un booster tous les 5 paliers) pour les assidus. Un **cosmétique final** désirable (un dos de carte animé). | P1 | 2 j |
| Missions | Toutes liées à l'activité (« ouvre 2 boosters »). Elles se font toutes seules et ne créent pas d'objectif. | Ajouter des **missions de collection** : « Obtiens une carte de l'album Révolutions », « Gagne un duel avec 3 Européens », « Réponds juste sur une figure d'Afrique ». **Relance** d'une mission par jour. | P1 | 1,5 j |
| Série | Ne compte que booster et quiz. Un gel par semaine. | Compter toute action (duel compris). Réparation mensuelle (BUSINESS §5.4). Paliers 7/30/100 avec un **cadre de série**. | Quick win | 0,5 j |
| Connexion | Pas de calendrier (prévu en BUSINESS §5.4). | Calendrier de 7 jours **non punitif** avec un booster au J7. | P1 | 1,5 j |
| Événements | Aucun moteur d'événements (prévu en v1.2). | Pour le lancement, **un calendrier éditorial piloté par JSON côté serveur** : figure du jour d'anniversaire (naissance ou mort), booster thématique du week-end, quiz thématique. On commence avec 52 semaines prêtes (Mandela Day, 14 juillet, 4 juillet, 8 mars, chute du Mur, journées des indépendances). | P1 | 3 j + contenu |
| Notifications | Push à distance avec catégories : bien. | Contenu des notifications **personnalisé par la collection** : « C'est l'anniversaire de Simón Bolívar, tu l'as en holo ! » ou « Il te manque 1 carte pour finir “Pères fondateurs” ». Toujours en respectant les plafonds de BUSINESS §5.9. | P1 | 1,5 j |
| Social | Amis, profils, comparaison, signalement. Pas de flux ni de cadeaux. | Fil « activité des amis » (tirages légendaires, albums finis), **réactions** (👏), Pioche diplomatique, défis de duel, dons. | P1–P2 | 5 j |

### Risques par cohorte
- **J1** : l'onboarding est en cours. Le risque, c'est un premier booster sans moment fort (P0-7) et un **accueil mort** après 2 boosters (P0-8). Objectif : à la fin de la session 1, le joueur a vu une légendaire, fait un quiz, gagné un duel et crafté une carte.
- **J7** : risque de lassitude, avec un duel répétitif et des missions automatiques. Les leviers sont le passe (visible), les albums, le premier ami et la Pioche.
- **J30** : avec l'économie actuelle, un assidu a **60 % du set** et le passe fini. Le risque, c'est « il ne reste que des légendaires et des mythiques inatteignables ». Les leviers sont les finitions, les secret rares, les albums difficiles, la campagne et la ligue. **Il manque du contenu de fin de partie** : c'est le risque principal pour le J30.

---

## 6. Monétisation (BUSINESS.md)

**Ce qui est bon** : pas de booster payant, une seule monnaie, l'euro affiché à côté, la Belgique et les Pays-Bas gérés, un seul abonnement, pas de pubs. C'est **le modèle le plus défendable du genre** et un vrai argument de presse.

**Risques et ajustements**
1. **« +2 boosters/jour » vaut plus que Pocket pour moitié prix**. C'est attractif, mais ça **double la vitesse de complétion** sur un set qui se finit déjà en 4–5 mois. À l'arrivée de la saison 2, les abonnés auront tout et s'ennuieront : c'est une source de churn. Je recommande **+1 booster/jour plus 1 Pioche/jour plus du confort** au lancement, avec un passage possible à +2 en promotion. Tester les deux (BUSINESS §6.4) avant de se figer : **on peut toujours donner plus, retirer est impossible**.
2. **Ce pour quoi les joueurs de TCG paient vraiment** : (a) les **alt-arts et illustrations** (chasse esthétique), (b) l'**expression de soi** (vitrine, album, cadre, dos de carte, emotes en duel), (c) le **gain de temps** (abonnement). Aujourd'hui, (a) n'existe pas et (b) se résume à quelques avatars et bannières. **Sans un catalogue cosmétique désirable au lancement des Sceaux, ils ne se vendront pas.** Priorités : dos de cartes, **cadres de vitrine**, skins d'album, **emotes de duel** (« Objection ! », « Motion adoptée »), effets d'ouverture.
3. **Alt-arts vendus directement en Sceaux ?** C'est **non aléatoire**, donc compatible avec D3. Mais un portrait illustré d'une figure **vivante** vendu = exploitation commerciale de l'image (BUSINESS §4.4). Limiter aux **figures mortes depuis plus de 70 ans** et aux cartes « Moments ».
4. **Passe Premium inclus** : bien. Mais la piste Premium doit **se voir** dans le passe gratuit dès le J1, en grisé avec un cadenas : c'est la meilleure publicité pour l'abonnement, et elle n'est pas agressive.
5. **Pack Fondateur à 2,99 €** : bonne offre. Ajouter une **carte promo « Fondateur » non échangeable**, une illustration d'un « Moment » historique (pas une personne), pour donner une valeur de collection durable aux premiers joueurs.
6. Le paywall au J3 ou après 6 boosters : d'accord. **Jamais pendant une ouverture de booster.**

---

## 7. UX et UI (captures et code)

| # | Écran | Problème | Correctif | Prio |
|---|---|---|---|---|
| 1 | Accueil (2) | Bouton « OUVRIR » grisé sans alternative. Le compte à rebours « 10:14:52 » est anxiogène. | P0-8. Afficher « Demain 04:50 » plutôt qu'un chronomètre quand c'est > 2 h. | P0 |
| 2 | Accueil (2) | La carte de figure du jour est tronquée et le booster carrousel déborde sous la carte. | Hiérarchie : booster d'abord, figure du jour en bannière compacte. | P1 |
| 3 | Révélation (3) | Carte petite (60 % de l'écran), fond beige plat. Le badge « Nouveau » est le seul élément festif. Gemme de rareté minuscule. | Carte à ~85 % de largeur, **fond qui change de couleur selon la rareté**, particules, nom de rareté en clair (« ÉPIQUE ») au moment du retournement. | P1 |
| 4 | Révélation (3) | Drapeau ougandais faux (P0-6). | — | P0 |
| 5 | Cartes holo (4, 6) | Le foil couvre le visage. | Masque du sujet (§1.5). | P1 |
| 6 | Collection (9) | Ouverture sur des cases noires numérotées. | Vue Albums ou « possédées d'abord », silhouette et nom des manquantes. | P1 |
| 7 | Détail (7) | « au round 3 » alors que l'app dit « manche » ailleurs. Mélange de « −2 » et « -2 ». | Normaliser à la génération (`scripts/build-cards`) : un seul gabarit de description par type d'effet. | Quick win |
| 8 | Détail (7) | Boutons « RETIRER DE LA VI… » et « METTRE EN FAVO… » tronqués. Onglet « Pass de sai… » tronqué (1, 5). | Icône plus libellé court (« Vitrine », « Favori », « Passe »). Un test de troncature en CI à 360 pt de large. | Quick win |
| 9 | Détail (7) | La fiche n'aide pas à **utiliser** la carte : rien sur ses meilleures manches, ni sur les albums dont elle fait partie. | Bloc « En duel : excellente en Stratégie (10) », « Albums : Waterloo, Premiers ministres britanniques ». Actions recycler, crafter et améliorer la finition ici. | P1 |
| 10 | Montée de niveau (8) | Le voile translucide laisse lire les missions dessous, « NIVEAU SUPÉRIEUR » se superpose à du texte, et un toast « Récompense » est empilé au-dessus. | Voile opaque à 90 %, **file d'attente des célébrations** (une seule à la fois) dans `ProgressionHost`, récompenses en grosses icônes plutôt qu'en pastilles de texte. | P1 |
| 11 | Passe (1, 5) | Un seul palier visible, 60 % d'écran vide. | Piste complète (§5). | P1 |
| 12 | Profil (4) | Bon écran. Mais « 19 cartes sur 500 » sous la carte favorite est mal placé, et il n'y a ni stats de duel, ni albums, ni série. | Ruban de stats : % du set, albums finis, meilleure série, victoires. | P2 |
| 13 | Global | Le retour sensoriel est inégal : beaucoup d'écrans sans son ni micro-animation (les missions qu'on réclame, le craft). | Le craft doit être un **mini-moment** (la carte se matérialise à partir des jetons) ; les réclamations ont une **pluie de jetons** vers le compteur. | P1 |

---

## 8. Ce qui manque face aux meilleurs TCG de collection

| Fonction | Référence | MANDAT | Prio |
|---|---|---|---|
| Wonder Pick / Pioche | TCGP | Prévue | P1 |
| Pack points (garantie déterministe) | TCGP | Non (Influence) | P1 |
| God packs et booster rare visible avant ouverture | TCGP | Non | P1 |
| Alt-arts, immersives, secret rares | TCGP, Snap (variants), FUT | Non | P1–P2 |
| Albums et pages à compléter avec récompenses | Panini, Topps Bunt | Non | P1 |
| Échanges entre amis | TCGP, Topps Bunt | Prévu v1.2 | P2 |
| Dons de doublons | Panini app, Monopoly Go (stickers) | Non | P2 |
| Liste de souhaits | Topps | Non | P1 |
| Amélioration de finition (fusion) | Snap (split et upgrade), FUT (évolutions) | Non | P1 |
| Deck ou cabinet | Tous | Non (3 cartes ad hoc) | P1 |
| PvP asynchrone et défis d'amis | Snap, Clash Royale, LoR | Non | P1–P2 |
| Ligue classée | Snap, HS, MTGA | Prévue v2 | P2 |
| Contenu solo scénarisé | LoR (Path of Champions), Shadowverse (histoire) | Non | P2 |
| Événements datés réels | FUT (TOTW), Snap (saisons) | Figure du jour seulement | P1 |
| « Équipe de la semaine » tirée de l'actualité | FUT TOTW | Non. Version prudente : **« Figure de la semaine »** sur un anniversaire historique, avec une finition spéciale à gagner | P2 |
| Emotes en duel | HS, Snap, Clash Royale | Non | P2 |
| Partage de tirage (image) | TCGP, FUT | Prévu | P1 |
| Classement de collection entre amis | Topps, Panini | Comparaison seulement | P1 |
| Quiz du jour partagé | Wordle, Duolingo | Non | P1 |
| Archives et rotation des sets | TCGP, Snap | Prévu (« Archives ») | P2 |

### Feuille de route proposée
**Lancement (≈ 4 semaines)**
- Les 8 P0 (~11 j plus contenu et juridique).
- Les 10 quick wins (§9, ~6 j).
- Révélation escaladée et holo masqué (5 j).
- Événements pilotés par JSON avec 8 semaines de contenu (3 j).

**+1 mois (v1.1)**
- Albums (10 au départ) et vue Albums de la collection (4 j).
- Pioche diplomatique (4 j), liste de souhaits (1 j).
- Points de Voix (pack points) et nouvelle grille de craft et recyclage 1:10 (3 j).
- Duel : domaines annoncés, cabinet de 5, synergies, capacité active, validateur de capacités (8 j).
- Passe à 2 pistes et monétisation v1.1 (BUSINESS §5.11).
- Quiz du jour partagé et 3 nouveaux gabarits (4 j).

**+3 mois (v1.2–v2)**
- Secret rares « Moments » (20 cartes) et alt-arts des épiques+ décédées (contenu, 2–3 semaines d'art).
- Défis d'amis, puis PvP asynchrone et ligue (7 j).
- Échanges et dons (4 j), amélioration de finition (2 j).
- Campagne historique, chapitre 1 « Rome » (6 j plus contenu).
- Saison 2 : rééquilibrage régional et temporel, avec Antiquité et Moyen Âge ≥ 20 %.
- Boutique cosmétique (dos, cadres, emotes, skins d'album).

---

## 9. Top 10 des quick wins (≤ 1 jour chacun)

1. **Plafond quotidien des récompenses de quiz et de duel** (P0-1), affiché dans l'UI. *1,5 j*
2. **Finition forcée `standard` et exclusion de l'IA, de la vitrine et du partage pour les cartes sensibles** (une partie de P0-2, sans toucher au contenu). *0,5 j*
3. **Premier booster : l'épique+ en dernier, avec une holo garantie**, et une légendaire garantie dans les 3 premiers boosters (P0-7). *0,5 j*
4. **Jauges de pity visibles** sous le booster (`PityDto` existe déjà). *0,5 j*
5. **Une action principale toujours disponible sur l'accueil** quand la jauge est vide (P0-8). *1 j*
6. **Vrais drapeaux** (SVG libres) plus un emblème pour les États historiques (P0-6). *1 j*
7. **Validateur de build** : il refuse `opponentRarityHigher` sur les légendaires et mythiques et normalise les descriptions (« manche », « − »). Gandhi est corrigé. *0,5 j*
8. **Collection : « possédées d'abord » par défaut**, et nom et pays visibles sur les cartes manquantes. *0,5 j*
9. **File d'attente des célébrations** (montée de niveau, toast, récompense : une à la fois, voile opaque). *0,5 j*
10. **Libellés courts et test de troncature** (onglet « Passe », boutons « Vitrine » et « Favori »), plus le disclaimer « La rareté reflète la notoriété mondiale actuelle » dans l'aide des cotes. *0,5 j*

---

## Annexe A — Simulation de duel (méthode)

Script de travail (hors dépôt) qui reproduit `DuelEngine.resolve` : deux cartes au hasard parmi les 500, un domaine au hasard, une manche et un score plausibles. 200 000 tirages pour l'activation des capacités, 300 tirages par carte pour les taux de victoire.

| Mesure | Valeur |
|---|---|
| Manches où au moins une capacité bonus ou malus s'applique | 23,2 % |
| Manches dont l'issue dépend d'une capacité ou d'une règle d'égalité | ~13,7 % |
| Égalité brute de stats | 14,6 % |
| Taux de victoire par manche : commune / peu commune / rare / épique / légendaire / mythique | 54 / 51 / 46 / 43 / 51 / **37 %** |
| Total de stats moyen des mythiques | 20,1 (contre 21,5 pour les communes) |

## Annexe B — Données catalogue utiles

- Répartition par continent (C/PC/R/É/L/M) : Afrique 56/10/6/1/1/1 · Asie 5/26/28/16/5/1 · Europe 10/56/41/29/15/6 · Amérique du Nord 26/28/20/12/9/2 · **Amérique du Sud 69/0/4/2/0/0** · **Océanie 14/0/1/0/0/0**.
- Époques : contemporaine 341, moderne 107, Antiquité 33, Moyen Âge 19.
- Vivants : 174, dont 89 communes.
- Sensibles (24) : 2 mythiques (Hitler, Staline), 3 légendaires (Mao, Mussolini, Saddam Hussein), 2 épiques (Kadhafi, Goebbels), 8 rares (dont Eichmann, Göring, Pol Pot, al-Baghdadi), 4 peu communes, 5 communes.
- Capacités : 334 à +2, 67 à +3, 37 à +1, 62 « égalités ». 397 sur 500 visent une stat précise.
- Économie `current` (50 parties) : F2P assidu à 2,86 boosters/jour, 60 % du set au J30, set complet en 132 jours, ~140 000 Influence par an. Premium assidu à 5,0 boosters/jour, set complet en 82 jours.
