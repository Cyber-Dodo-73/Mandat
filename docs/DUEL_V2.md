# MANDAT — Duel v2 : « Hémicycle »

Document de conception jouable et implémentable. Il remplace le duel v1 (3 cartes, 3 manches, un domaine
tiré par manche) décrit dans `api/.../duel/` et `mobile/src/features/duel/`. Il tient compte de la revue
TCG (`docs/TCG_REVIEW.md` §4) et de la stratégie (`docs/BUSINESS.md` §5.7, pas de pay-to-win).

Les chiffres de ce document sortent du simulateur `scripts/duel-sim/` (Python, bibliothèque standard
uniquement), lancé sur le vrai catalogue `data/cards.season1.json`. Pour les reproduire :

```bash
python3 scripts/duel-sim/simulate.py            # toutes les sections (~15 min)
python3 scripts/duel-sim/simulate.py --variants # journal de réglage
python3 scripts/duel-sim/queue_sim.py           # file d'attente PvP
```

Sommaire : 1. Objectifs · 2. Règles · 3. Données des 500 cartes · 4. Équilibrage et résultats ·
5. PvP, appariement, classement · 6. IA solo · 7. UX · 8. Architecture · 9. Plan de mise en œuvre ·
10. Décisions ouvertes.

**En bref.** Deck de 10 cartes. 3 territoires (Parlement/Influence, Sommet/Diplomatie, Opinion/Charisme,
État-major/Stratégie), chacun avec un contexte. 6 tours ; au tour N, N de capital politique. Les deux
joueurs posent en secret, puis tout se révèle. La puissance d'une carte = sa stat du territoire + son
Envergure + son mot-clé. On gagne en remportant 2 territoires sur 3. Le coût de chaque carte est calculé
depuis ses stats et sa capacité, donc toutes les cartes sont jouables et la rareté ne donne aucune
puissance. Les rares et au-delà ont une signature (Polyvalent, Ralliement, Mobilisation, Discret). En
classé, la Surenchère double l'enjeu (bluff, retrait). PvP temps réel en WebSocket ; appariement par MMR,
niveau et collection ; fantômes au-delà de 18 s d'attente.

---

## 1. Objectifs de conception

### 1.1 Ce qui ne va pas en v1
- Une seule décision par manche, souvent évidente (la revue mesure des capacités actives dans 23 % des
  manches seulement).
- La collection ne compte pas : l'IA compose son équipe autour de la moyenne de stats du joueur.
- La rareté pénalise : règle « l'outsider gagne les égalités », capacités « si la carte adverse est plus
  rare ». En v1, une mythique gagne 37 % des manches contre une carte au hasard, une commune 54 %.
- Pas de deck, pas de PvP, pas de classement. Verdict du joueur : « les combats sont un peu minables ».

### 1.2 Ce que doit être la v2
| Objectif | Cible mesurable |
|---|---|
| Partie courte | 2 à 4 min, 6 tours, une phase de jeu de 30 s au maximum par tour |
| Facile à apprendre | 3 règles à l'écran : *capital = numéro du tour*, *la puissance = la stat du territoire*, *gagnez 2 territoires sur 3* |
| Profond | ~7 cartes jouées par joueur et par partie, chaque carte pose 2 questions (où et quand) ; une IA qui calcule bat une IA naïve à ~70 % |
| Chance maîtrisée | Le hasard vient de la pioche et des territoires, jamais d'un dé caché à la résolution. Le niveau de jeu doit peser plus que le deck (IA « hard » ≥ 65 % contre « normal » à decks équivalents) |
| Moments forts | Bluff (jeu simultané caché, cartes Discret, Surenchère), retournements (Sursaut, Pression, dernier tour), combos (Délégation, Compatriotes, Ralliement) |
| Lisible sur un téléphone | Portrait, 3 colonnes, 3 cartes maximum par camp et par colonne, un seul nombre par carte sur le plateau |
| Aucun pay-to-win | Le coût d'une carte est calculé depuis sa puissance. Taux de victoire par rareté entre 49 et 51 %. Aucune carte, aucun mot-clé ne dépasse le bruit de plus de quelques points |
| La collection compte | Construire autour des synergies (continent, pays, ère, mots-clés) rapporte plus que les stats brutes. Une grande collection donne plus d'options, pas des cartes plus fortes |
| Rares excitantes | Les rares et au-delà ont un **mot-clé de signature** (Polyvalent, Ralliement, Mobilisation, Discret) : plus de jeu, pas plus de puissance (elles coûtent ce qu'elles valent) |

### 1.3 Pourquoi ce modèle (et pas un autre)
- **Territoires simultanés à la Marvel Snap** plutôt que points de vie à la Hearthstone : parties de
  3 minutes, pas d'ordre de jeu donc pas d'attente de l'adversaire, et la révélation simultanée garde le
  frisson du v1 (« on retourne les cartes »).
- **Les 4 stats deviennent 4 territoires** : le v1 annonçait un domaine par manche ; la v2 en pose trois
  côte à côte. Les stats existantes servent telles quelles, sans réécrire une seule carte.
- **Coût en capital dérivé des stats** : c'est ce qui rend toutes les cartes jouables. Churchill (15 de
  total) n'est plus une « mauvaise mythique » mais une carte à 3 de capital ; Nancy Reagan (29)
  coûte 4 avec +2 d'Envergure. La revue reproche aux totaux tirés au hasard d'être incohérents avec la figure : le coût
  neutralise l'effet sur la puissance (l'incohérence éditoriale reste un sujet de contenu, §3.5).
- **Deck de 10, pas 12** : avec des figures uniques (une seule carte par personnage), 10 cartes se
  construisent dès ~25 cartes possédées, et on voit 9 cartes sur 10 dans une partie, donc le deck qu'on a
  construit est bien celui qu'on joue.

---

## 2. Règles complètes

### 2.1 Le deck (« Cabinet »)
- **10 cartes différentes** de sa collection (une carte = une figure ; la finition ne change rien en jeu,
  elle s'affiche).
- Aucune contrainte de rareté. Pas de limite de copies (il n'en existe qu'une par figure).
- Les figures sensibles sont des cartes comme les autres : jouables, avec leur rareté et leurs finitions.
  Seules leurs règles de présentation changent (§2.9).
- Joueur avec moins de 10 cartes : **Cabinet d'investiture** prêté (10 communes fixes) pour le tutoriel
  et l'IA, jamais en PvP classé.

### 2.2 Le plateau
- **3 territoires** tirés au début parmi 4. Chacun lit une stat :

| Territoire | Stat lue | Icône |
|---|---|---|
| Parlement | Influence | hémicycle |
| Sommet | Diplomatie | poignée de main |
| Opinion | Charisme | micro |
| État-major | Stratégie | carte d'état-major |

- Chaque territoire reçoit un **contexte** (tiré sans doublon, sauf « Calme ») visible dès le début :

| Contexte | Poids | Règle |
|---|---|---|
| Calme | 3 | Aucun effet. |
| Crise | 1 | Les cartes de coût 1 ou 2 ont +2 ici. |
| Multilatéral | 1 | +1 par continent différent parmi vos cartes ici. |
| Scandale | 1 | Fermé après le tour 4 : plus aucune carte ne peut y être jouée. |
| Majorité absolue | 1 | 2 cartes maximum par camp ici. |
| Tribune | 1 | La première carte jouée ici par chaque camp a +3. |
| Archives | 1 | Les cartes antiques, médiévales et modernes ont +2 ici. |
| Coalition | 1 | Délégation et Compatriotes rapportent le double ici. |

- **3 emplacements par camp et par territoire** (2 en Majorité absolue), donc 9 cartes au maximum.

### 2.3 Déroulement d'une partie
1. Les deux decks sont mélangés. Chaque joueur pioche **3 cartes**.
2. **6 tours.** Au début de chaque tour, chaque joueur pioche 1 carte (main maximum 7) et reçoit un
   **capital politique égal au numéro du tour** (1, 2, … 6). Le capital non dépensé est perdu.
3. **Phase de jeu simultanée (30 s)** : chacun pose face cachée des cartes de sa main sur des
   territoires, tant que la somme de leurs coûts ne dépasse pas son capital. On peut ne rien jouer.
   La phase se termine quand les deux ont validé, ou à la fin du chrono (ce qui est posé et valide est
   joué ; un brouillon invalide est abandonné).
4. **Révélation** : le joueur qui a **l'initiative** révèle toutes ses cartes du tour, dans l'ordre où il
   les a posées, puis l'autre. L'initiative revient à celui qui **mène** (plus de territoires gagnés, puis
   plus de puissance totale) ; à égalité parfaite, elle alterne à partir d'un tirage au sort au tour 1.
   Révéler en second est un léger avantage (on réagit à un plateau plus récent), donc le joueur mené le
   reçoit : c'est un rattrapage naturel.
5. Après le tour 6, on compte.

### 2.4 Puissance et victoire
Puissance d'une carte posée sur un territoire :

```
puissance = stat du territoire (ou sa meilleure stat si Polyvalent)
          + Envergure de la carte                // barème du coût + compensation, imprimée sur la carte
          + bonus de son mot-clé s'il est actif  // Soutien
          + bonus du contexte
```

Puissance d'un camp sur un territoire = somme de ses cartes + Ralliement + **coalition** (le meilleur
des deux bonus ci-dessous, ils ne se cumulent pas) − Pressions adverses actives, jamais sous 0.

- **Délégation** : au moins 3 de vos cartes du même continent ici → +1.
- **Compatriotes** : vos 3 cartes ici viennent du même pays → +2 (une délégation nationale complète).

**Victoire** : le camp le plus puissant gagne le territoire. Égalité : un camp qui a un **Véto** actif ici
l'emporte (si un seul en a), sinon personne. Le joueur qui gagne **le plus de territoires** gagne la
partie ; à égalité de territoires, celui qui a le plus de **puissance totale** ; sinon match nul
(0,7 % des parties simulées).

L'**Envergure** est le seul nombre ajouté aux cartes ; un laurier sur la gemme de coût l'affiche.
Elle vaut le **barème du coût** (+0, +0, +1, +2, +3, +5 pour les coûts 1 à 6 : sans lui, les cartes chères
ne valent pas leur capital, voir §4.4) plus une **compensation** de 0 à 3 pour les cartes du bas de leur
tranche de coût (les coûts sont entiers, les valeurs non : la compensation rapproche toutes les cartes
d'un même coût). Sur le catalogue : 72 cartes à +0, 149 à +1, 126 à +2, 79 à +3, 74 à +4 ou plus.

### 2.5 Mots-clés (traduits automatiquement des effets existants)
Chaque carte garde **un** effet machine (`ability.effect`). La v2 lit le *type* (ce que fait l'effet),
le *montant* et la *condition* (le mot-clé). La *stat* nommée par l'effet (« +2 en Charisme ») **ne
limite plus** l'effet à un territoire : en v1, c'est ce verrou qui faisait que les capacités ne
servaient presque jamais. Le mot-clé marche sur tous les territoires, et la condition Spécialiste garde
seule un lien avec une stat. Le texte de règle est généré (§3.3), le nom de la capacité reste celui de
la carte.

Types :
| v1 | v2 | Effet |
|---|---|---|
| `bonus` | **Soutien** | +N à cette carte |
| `malus` | **Pression** | −N à la puissance du camp adverse sur ce territoire |
| `tieBreaker` | **Véto** | Gagne ce territoire en cas d'égalité |

Conditions → mots-clés :
| v1 (`condition.kind`) | Mot-clé v2 | Actif quand… |
|---|---|---|
| `always` | **Constant** | toujours |
| `opponentContinent: same` | **Alliance** | une autre de vos cartes ici vient du même continent |
| `opponentContinent: different` | **Ouverture** | une autre de vos cartes ici vient d'un autre continent |
| `opponentEra: X` | **Riposte (X)** | une carte adverse ici est de l'ère X |
| `roundDomain: X` | **Spécialiste (X)** | ce territoire lit la stat X |
| `round: 1` | **Tempo — Entrée en fonction** | jouée au tour égal à son coût, ou au suivant |
| `round: 2` | **Tempo — Mi-mandat** | jouée aux tours 3–4 (tour 6 si elle coûte 5 ou 6) |
| `round: 3` | **Tempo — Dernier mot** | jouée aux tours 5–6 (tour 6 si elle coûte 6) |
| `behind` | **Sursaut** | au moment de sa révélation, votre camp était mené ici (verrouillé ensuite) |
| `opponentRarityHigher` | **Outsider** | une carte adverse ici coûte plus cher (ou 6, si elle-même coûte 6) |

Plus aucune règle ne dépend de la rareté : « Outsider » regarde le coût, la règle v1 « la rareté
inférieure gagne les égalités » disparaît.

Toutes les conditions sont **continues** (recalculées sur le plateau courant) sauf Sursaut et Tempo,
fixés quand la carte est révélée. C'est ce qui rend l'ordre de pose et l'initiative intéressants.

### 2.6 Signatures (rares, épiques, légendaires, mythiques)
Une carte rare ou plus a un second mot-clé, choisi par sa stat la plus haute (égalité : ordre
Influence > Diplomatie > Charisme > Stratégie). Elles ne sont pas plus fortes : leur valeur entre dans
le calcul du coût (§3.2), donc une rare coûte en moyenne 3,8 et une légendaire 4,4, contre 3,0 pour une commune.

| Stat la plus haute | Signature | Effet | Pourquoi c'est excitant |
|---|---|---|---|
| Influence | **Polyvalent** | Utilise sa meilleure stat sur n'importe quel territoire | Va partout, liberté de placement |
| Diplomatie | **Ralliement** | +1 à chacune de vos autres cartes ici | Carte de combo, récompense l'empilement |
| Charisme | **Mobilisation** | À sa révélation : piochez une carte | Avantage de cartes, dernier tour plus riche |
| Stratégie | **Discret** | Révélée face cachée : l'adversaire ne voit que son coût jusqu'à la fin | Bluff ; la révélation finale est un moment fort |

Répartition sur le catalogue : 69 Polyvalent, 53 Mobilisation, 44 Ralliement, 34 Discret ; 300 cartes
(communes, peu communes) sans signature, ce qui garde les premières parties simples.

### 2.7 Surenchère (classé uniquement)
L'enjeu de base vaut **1 Voix** (point de classement). Une fois par tour, pendant la phase de jeu, un
joueur peut appuyer sur **Surenchérir** : à la fin du tour l'enjeu double (2, 4, puis 8 maximum).
L'adversaire le voit à la révélation. Au début du tour 6, l'enjeu double automatiquement (s'il n'est pas
déjà à 8). À tout moment, un joueur peut **se retirer** : il perd l'enjeu courant (sans le doublement en
attente) au lieu de l'enjeu final. Partie gagnée = +enjeu Voix, perdue = −enjeu, nulle = 0.

C'est la couche de bluff à la Snap : surenchérir avec un Discret posé, se retirer d'une partie perdue à
1 Voix au lieu de 8. Hors classé (IA, occasionnel, défi d'ami), pas de Surenchère : on garde l'écran
simple tant que le joueur n'a pas atteint le niveau du classé.

### 2.8 Règles fines (pour l'implémentation)
- Une carte jouée ne bouge plus. Pas de défausse, pas de pioche quand la main est pleine (la carte reste
  dans le deck).
- Le chrono de 30 s démarre quand le serveur ouvre la phase. Le serveur clôt la phase dès que les deux
  joueurs ont validé.
- Ordre de révélation au sein d'un camp : ordre de pose. Sursaut d'une carte se calcule juste avant sa
  propre révélation (les cartes déjà révélées ce tour comptent).
- Discret : la carte est comptée dans les puissances côté serveur. L'adversaire voit « ? » et une
  puissance de camp affichée « ≥ X » (la puissance sans les cartes cachées). Les effets d'une carte
  Discret (Pression, Véto) s'appliquent, et l'adversaire en voit l'effet total sans savoir d'où il vient.
  Tout est révélé à la fin du tour 6 avant le décompte.
- Scandale : après le tour 4, le territoire ne prend plus de cartes, ses puissances évoluent encore
  (conditions continues).
- Égalité de puissance totale ET de territoires : match nul (Voix 0, MMR comme un nul).

### 2.9 Figures sensibles : règles de présentation
Les 23 cartes `sensitive: true` jouent comme les autres. En revanche :
- Sur le plateau, dans le deck builder et dans les journaux de partie, une carte sensible affiche
  **le nom générique de son mot-clé** (« Pression », « Tempo — Dernier mot »), jamais le nom de sa
  capacité. Cela règle sans réécriture les noms à problème relevés par la revue (« Guerre totale »,
  « Règne de la terreur », « Diamants du sang », « Pillage », « Année zéro », « Guerre populaire »,
  « Propagande » sur Goebbels et Mussolini, « Coup d'État » sur Idi Amin Dada).
- Aucune célébration centrée sur elles : l'écran de fin met en avant « la carte décisive » mais saute les
  cartes sensibles ; pas d'animation spéciale, pas de citation.
- Aucun mot-clé ni contexte n'est nommé d'après un crime ou une pratique de régime (pas de « Purge »,
  « Terreur », « Propagande », « Coup d'État » comme mécanique). Les noms retenus sont institutionnels.
- Les noms de decks (visibles des adversaires et des fantômes) passent par le filtre de modération
  existant, et refusent les noms de figures sensibles accolés à des termes injurieux ou à des slogans.

---

## 3. Des données existantes au système v2

Aucune réécriture manuelle n'est nécessaire pour la v2.0. Tout ce qui suit est calculé depuis
`data/cards.season1.json`.

### 3.1 Champs utilisés
| Champ | Usage v2 |
|---|---|
| `stats.*` | Puissance par territoire, valeur, coût |
| `ability.effect.type` | Soutien / Pression / Véto |
| `ability.effect.stat` | Ignorée en v2.0 (l'effet marche partout) ; conservée pour revenir au verrou v1 si besoin |
| `ability.effect.amount` | Valeur du bonus |
| `ability.effect.condition` | Mot-clé (§2.5) |
| `continent`, `country`, `era` | Alliance, Ouverture, Riposte, Délégation, Compatriotes, Archives, Multilatéral |
| `rarity` | Signature (rare et plus) ; jamais la puissance |
| `sensitive` | Règles de présentation (§2.9) |
| `ability.name` | Affiché (sauf cartes sensibles) |

### 3.2 Formule du coût
1. **Valeur** d'une carte (`engine.card_value`) :

```
s1 ≥ s2 ≥ s3 ≥ s4 = stats triées
base      = 0,75·s1 + 0,25·s2            // on la pose en général sur sa meilleure stat (3 territoires sur 4)
capacité  = amount × P(condition)          (Véto : 0,6 × P(condition))
signature = Polyvalent : s1 − base ; Ralliement 1,0 ; Mobilisation 1,6 ; Discret 0,6
valeur    = base + capacité + signature + correctif (value_overrides.json)
```

`P(condition)` est le taux d'activation **mesuré** en fin de partie par le simulateur (3 000 parties,
archétypes mélangés), arrondi : Constant 1 ; Alliance 0,5 ; Ouverture 0,7 ; Riposte contemporaine 0,8,
moderne 0,45, antique 0,25, médiévale 0,1 ; Spécialiste 0,4 ; Tempo 0,7 / 0,5 / 0,4 ; Sursaut 0,7 ;
Outsider de 0,85 (coût 1) à 0,1 (coût 6). À remesurer quand une règle change.

2. **Coût** par découpage en quantiles de la valeur (tri stable par valeur puis par id) selon la courbe
   cible : 12 % de coût 1, 20 % de 2, 22 % de 3, 20 % de 4, 15 % de 5, 11 % de 6. Deux passes, car la
   probabilité d'Outsider dépend du coût.
3. **Envergure** = barème du coût + compensation `clamp(round(v90 − valeur), 0, 3)`, où `v90` est le
   90e centile des valeurs de la tranche de coût.
4. **Correctif** : `simulate.py --autotune N` joue des dizaines de milliers de parties, mesure le taux de
   victoire de chaque carte, pousse la valeur des cartes hors de ±2 σ (une carte trop forte vaut plus, donc
   coûte plus), puis redécoupe. Résultat committé : `scripts/duel-sim/value_overrides.json` (318 cartes
   corrigées, entre −1,6 et +1,7 de valeur). C'est le seul « patch d'équilibrage » et il est versionné.

Le coût et le profil de chaque carte sont exportés par `simulate.py --export data/duel/season1.json`
(coût, Envergure, mot-clé, paramètres, signature, tours de Tempo). Le serveur charge ce fichier avec le
catalogue ; le simulateur reste la source de vérité des formules, le serveur ne recalcule rien.

### 3.3 Textes de règle générés
Le client et le serveur génèrent le texte à partir du profil, en fr et en en (gabarits i18n), par exemple :
- Trump (s1-001), « Coup médiatique » : *Tempo — Entrée en fonction : +2 si jouée au tour 4 ou 5.*
  Signature *Polyvalent*. Coût 4, Envergure +2.
- Churchill (s1-008), « Du sang et des larmes » : *Sursaut : +3 si votre camp était mené ici à sa
  révélation.* Signature *Mobilisation*. Coût 3, Envergure +1.

L'ancienne description (« lors de la 1re manche ») reste dans la fiche de collection pour le duel v1, puis
disparaît quand la v1 est retirée.

### 3.4 Vérification au build
`engine.reachable(card)` refuse toute capacité impossible ; `load_catalog` échoue s'il en trouve une.
Contrôles : fenêtre de Tempo atteignable compte tenu du coût, Outsider atteignable (règle spéciale pour
les cartes à 6), Spécialiste sur une autre stat que la sienne (effet mort), ère et stat connues.
Le même contrôle est à porter dans `scripts/build-cards` (validation des fichiers de contenu) et un test
JUnit le rejoue sur le catalogue chargé. Le taux d'activation réel est mesuré par la simulation (§4.2).

### 3.5 Ajouts de contenu
| Ajout | Nécessaire pour | Comment le produire |
|---|---|---|
| `data/duel/season1.json` (profils) | v2.0 | `simulate.py --export`, en CI |
| Gabarits i18n des mots-clés, contextes, territoires (fr/en) | v2.0 | ~60 chaînes, à la main une fois |
| Renommer les 9 capacités de cartes sensibles listées au §2.9 | Souhaitable (déjà masquées en duel) | Liste §2.9, à la main |
| Decks thématiques de l'IA (« Les Pharaons », « Guerre froide »…), 20 à 30 | v2.0 | Script : filtres continent/pays/ère + courbe ; noms à la main |
| Paires « Rivaux » / « Dynasties » (synergie v2.1, revue §4.2) | v2.1 | Liste éditoriale (~40 paires), un nouveau champ `duel.pairs` |
| Contextes supplémentaires (12 à 16) | v2.1 | Design + simulation |
| Resserrer les totaux de stats par figure (revue §4.4) | Indépendant | Le coût s'adapte tout seul : relancer `--autotune` |

---

## 4. Équilibrage

### 4.1 Méthode
- **Moteur** : `scripts/duel-sim/engine.py`, miroir exact des règles ci-dessus, déterministe (tout le
  hasard passe par un `random.Random`).
- **Bots** (`bots.py`), qui n'utilisent que l'information publique (main, plateau révélé, coût visible des
  cartes Discret) :
  - `random` : coups légaux au hasard ;
  - `easy` : `normal` qui joue au hasard un tour sur trois ;
  - `normal` : meilleur sous-ensemble de la main qui tient dans le capital, chaque carte sur le
    territoire où elle fait le plus monter un score `Σ tanh(marge / échelle)` ;
  - `hard` : 12 plans candidats environ, chacun évalué par 6 *rollouts* jusqu'à la fin de la partie où
    la main et le deck adverses inconnus sont **retirés au hasard dans le catalogue** (jamais les vraies
    cartes cachées).
- **Decks** : 10 cartes différentes tirées du catalogue réel (500 cartes) par archétype — courbe, valeur
  brute (meilleures stats à chaque coût, aucune synergie), rapide, lourd, délégation (un continent),
  compatriotes (un pays + son continent), pression, véto, sursaut/outsider, histoire (cartes
  pré-contemporaines), aléatoire, trop lourd (42 de coût pour 21 de capital).
- **Critères d'acceptation** : aucun archétype au-dessus de 62 % contre le champ (qui contient des decks
  faibles) et aucune confrontation entre decks construits au-delà de 70 % ; écart-type des cartes proche
  du bruit statistique ; rareté entre 49 et 51 % ; decks de synergie au moins au niveau de « valeur
  brute » ; avantage d'initiative au tour 1 sous ±3 points ; mots-clés actifs pour au moins 50 % des
  cartes jouées ; parties de 2 à 4 minutes.

### 4.2 Résultats (configuration v2.0 retenue, graine 2026)

#### Coûts obtenus (catalogue réel, 500 cartes)

| Coût | Cartes | Stat. max moyenne | Total moyen | Puissance moyenne au meilleur territoire* | Envergure moyenne |
|---|---|---|---|---|---|
| 1 | 60 | 4.9 | 15.3 | 5.5 | 0.5 |
| 2 | 100 | 5.9 | 17.6 | 6.5 | 0.6 |
| 3 | 110 | 7.0 | 20.9 | 8.4 | 1.4 |
| 4 | 100 | 7.8 | 24.1 | 10.1 | 2.2 |
| 5 | 75 | 8.6 | 26.2 | 11.8 | 3.3 |
| 6 | 55 | 9.2 | 27.5 | 14.9 | 5.7 |

*stat la plus haute + Envergure, hors capacité.

| Rareté | common | uncommon | rare | epic | legendary | mythic |
|---|---|---|---|---|---|---|
| Coût moyen | 2.99 | 3.30 | 3.77 | 3.52 | 4.43 | 3.90 |

#### Écart de niveau entre IA (decks « courbe » tirés au hasard, camps alternés)

| Ligne vs colonne | random | easy | normal | hard |
|---|---|---|---|---|
| random | — | 29.5 % | 17.5 % | 9.3 % |
| easy | 68.8 % | — | 36.5 % | 24.8 % |
| normal | 83.2 % | 66.3 % | — | 38.2 % |
| hard | 88.7 % | 75.3 % | 67.3 % | — |

#### Taux de victoire par archétype (12000 parties, IA « normal » des deux côtés)

| Archétype | Parties | Victoires | IC 95 % |
|---|---|---|---|
| compatriotes | 1967 | 61.4 % | ± 2.2 |
| valeur_brute | 2052 | 59.0 % | ± 2.1 |
| delegation | 1992 | 58.6 % | ± 2.2 |
| sursaut | 1967 | 55.4 % | ± 2.2 |
| histoire | 1974 | 53.4 % | ± 2.2 |
| courbe | 1987 | 52.7 % | ± 2.2 |
| pression | 1986 | 51.0 % | ± 2.2 |
| veto | 2038 | 50.8 % | ± 2.2 |
| rapide | 2053 | 46.7 % | ± 2.2 |
| aleatoire | 1973 | 44.5 % | ± 2.2 |
| lourd | 1977 | 39.1 % | ± 2.2 |
| trop_lourd | 2034 | 27.9 % | ± 1.9 |

Pire confrontation entre decks construits (hors aléatoire et trop lourd) : sursaut contre lourd = 72.4 % sur 147 parties.

#### Taux de victoire par archétype (1500 parties, IA « hard » des deux côtés)

| Archétype | Parties | Victoires | IC 95 % |
|---|---|---|---|
| compatriotes | 271 | 64.2 % | ± 5.7 |
| delegation | 249 | 59.4 % | ± 6.1 |
| valeur_brute | 255 | 58.8 % | ± 6.0 |
| rapide | 258 | 54.8 % | ± 6.1 |
| histoire | 225 | 53.6 % | ± 6.5 |
| courbe | 249 | 53.0 % | ± 6.2 |
| sursaut | 264 | 50.0 % | ± 6.0 |
| pression | 251 | 49.2 % | ± 6.2 |
| veto | 250 | 44.8 % | ± 6.2 |
| aleatoire | 221 | 42.5 % | ± 6.5 |
| lourd | 265 | 39.1 % | ± 5.9 |
| trop_lourd | 242 | 28.5 % | ± 5.7 |

#### Déroulement (6000 parties, IA « normal », archétypes mélangés)

| Mesure | Valeur |
|---|---|
| Victoires du joueur qui a l'initiative au tour 1 (hors nuls) | 49.6 % ± 1.3 |
| Matchs nuls | 0.5 % |
| Partie décidée aux territoires / à la puissance totale / nulle | 93.0 % / 6.5 % / 0.5 % |
| Retournements (le meneur après le tour 4 perd) | 34.6 % |
| Territoires gagnés au Véto | 1.5 % |
| Cartes dont le mot-clé est actif en fin de partie | 60.6 % |
| Cartes jouées par joueur | 6.8 |
| Capital dépensé par joueur (sur 21) | 19.0 |
| Cartes restées en main à la fin | 2.7 |
| Durée estimée (médiane) | 1.8 min |

#### Déroulement (800 parties, IA « hard », archétypes mélangés)

| Mesure | Valeur |
|---|---|
| Victoires du joueur qui a l'initiative au tour 1 (hors nuls) | 51.6 % ± 3.5 |
| Matchs nuls | 0.5 % |
| Partie décidée aux territoires / à la puissance totale / nulle | 91.9 % / 7.6 % / 0.5 % |
| Retournements (le meneur après le tour 4 perd) | 33.5 % |
| Territoires gagnés au Véto | 1.9 % |
| Cartes dont le mot-clé est actif en fin de partie | 64.2 % |
| Cartes jouées par joueur | 6.7 |
| Capital dépensé par joueur (sur 21) | 18.6 |
| Cartes restées en main à la fin | 2.8 |
| Durée estimée (médiane) | 1.8 min |

#### Cartes (40000 parties, decks « courbe » uniformes, IA « normal ») — 1600 apparitions par carte en moyenne

Taux de victoire quand la carte est dans le deck : écart-type 1.8 pts, P5 47.0 %, P95 53.2 %. Bruit statistique attendu (± 1 σ) : 1.2 pts.

| Par mot-clé | alliance | constant | outsider | ouverture | riposte | specialiste | sursaut | tempo |
|---|---|---|---|---|---|---|---|---|
| Victoires | 50.0 % | 49.9 % | 50.0 % | 50.5 % | 49.7 % | 49.9 % | 50.2 % | 49.9 % |

| Par type d'effet | pression | soutien | veto |
|---|---|---|---|
| Victoires | 49.8 % | 50.2 % | 49.5 % |

| Par rareté | common | uncommon | rare | epic | legendary | mythic |
|---|---|---|---|---|---|---|
| Victoires | 50.0 % | 50.0 % | 50.0 % | 49.8 % | 50.7 % | 49.7 % |

| Par ère | antiquity | contemporary | medieval | modern |
|---|---|---|---|---|
| Victoires | 49.4 % | 50.0 % | 48.8 % | 50.3 % |

| Par continent | africa | asia | europe | north_america | oceania | south_america |
|---|---|---|---|---|---|---|
| Victoires | 50.0 % | 50.0 % | 49.9 % | 49.9 % | 50.7 % | 50.0 % |

Les 8 cartes les plus fortes et les 8 plus faibles :

| Carte | Coût | Rareté | Mot-clé | Victoires |
|---|---|---|---|---|
| s1-096 Simón Bolívar | 3 | epic | riposte/soutien 2 | 55.0 % |
| s1-196 Sun Yat-sen | 1 | rare | alliance/veto  | 55.0 % |
| s1-027 George VI | 6 | legendary | tempo/soutien 2 | 54.6 % |
| s1-480 Jean VI de Portugal | 3 | common | ouverture/soutien 2 | 54.5 % |
| s1-013 Abraham Lincoln | 5 | legendary | sursaut/veto  | 54.5 % |
| s1-167 Alexandre Loukachenko | 3 | rare | sursaut/soutien 2 | 54.5 % |
| s1-481 Fernando Henrique Cardoso | 3 | common | ouverture/pression 2 | 54.4 % |
| s1-189 Josip Broz Tito | 5 | rare | outsider/soutien 2 | 54.3 % |
| … | | | | |
| s1-082 Tony Blair | 5 | epic | constant/soutien 1 | 42.8 % |
| s1-337 Jefferson Davis | 5 | common | alliance/pression 2 | 45.7 % |
| s1-190 Attila | 3 | rare | riposte/pression 2 | 45.8 % |
| s1-345 Karl Dönitz | 4 | common | sursaut/soutien 2 | 46.0 % |
| s1-309 Justinien | 2 | uncommon | riposte/veto  | 46.0 % |
| s1-115 Charlie Kirk | 5 | rare | riposte/soutien 2 | 46.2 % |
| s1-072 Marc Aurèle | 1 | epic | constant/veto  | 46.2 % |
| s1-304 Horatio Nelson | 4 | uncommon | tempo/pression 2 | 46.2 % |

Cartes hors de ± 3 σ du bruit : 20 sur 500 : s1-096 Simón Bolívar, s1-196 Sun Yat-sen, s1-027 George VI, s1-480 Jean VI de Portugal, s1-167 Alexandre Loukachenko, s1-481 Fernando Henrique Cardoso, s1-029 Mao Zedong, s1-379 Alberto Fujimori, s1-497 Juan Manuel de Rosas, s1-368 Pancho Villa, s1-233 George II, s1-158 Vlad III l'Empaleur, s1-257 Ursula von der Leyen, s1-323 James Monroe, s1-304 Horatio Nelson, s1-072 Marc Aurèle, s1-309 Justinien, s1-345 Karl Dönitz, s1-190 Attila, s1-082 Tony Blair

#### Effet de la taille de collection (deck « courbe » de qualité 0,8 tiré de la collection, IA « normal »)

| Collection A | Collection B | Victoires de A |
|---|---|---|
| 30 cartes | 500 cartes | 47.4 % |
| 60 cartes | 500 cartes | 46.4 % |
| 120 cartes | 500 cartes | 47.4 % |
| 250 cartes | 500 cartes | 49.4 % |
| 60 cartes | 120 cartes | 49.8 % |

_Calcul : 611 s sur un portable, graine 2026, catalogue `0432cef6b82899aa`, `python3 scripts/duel-sim/simulate.py`._

### 4.3 Lecture des résultats
| Critère (§4.1) | Mesure | Statut |
|---|---|---|
| Archétype le plus fort contre le champ ≤ 62 % | compatriotes 61,4 % (IA normal), 64,2 % ± 5,7 (IA hard) | Limite, à surveiller |
| Confrontation entre decks construits ≤ 70 % | sursaut contre lourd 72,4 % (147 parties, ± 7) | Limite : le deck lourd est le point faible |
| Écart-type des cartes proche du bruit | 1,8 pt mesuré pour 1,2 pt de bruit, soit ~1,3 pt d'écart réel ; 20 cartes sur 500 hors de ±3 σ (de 42,8 à 55,0 %) | OK, prochaine passe d'autotune |
| Rareté entre 49 et 51 % | 49,7 % (mythique) à 50,7 % (légendaire) | OK |
| Synergie ≥ valeur brute | délégation 58,6 %, compatriotes 61,4 %, valeur brute 59,0 % | OK, à égalité |
| Initiative au tour 1 sous ±3 pts | 49,6 % ± 1,3 (normal), 51,6 % ± 3,5 (hard) | OK |
| Mots-clés actifs ≥ 50 % | 60,6 % (normal), 64,2 % (hard), contre ~23 % des manches en v1 | OK |
| Partie de 2 à 4 min | 1,8 min modélisée avec 14 s de réflexion par tour ; 2 à 3 min attendues avec de vrais joueurs | OK |

- **Le niveau de jeu compte plus que le deck** : à decks comparables, « hard » bat « normal » 67 % du temps
  et « facile » 75 % ; un joueur qui pose au hasard ne gagne que 9 à 30 % de ses parties. Dans le v1, le
  meilleur coup était presque toujours évident.
- **Les synergies paient** : les decks d'un continent ou d'un pays sont en tête, à égalité avec un deck
  qui aurait les meilleures cartes de chaque coût. Un deck aléatoire perd (44,5 %), un deck mal courbé
  aussi (trop lourd : 28 %). La construction est un vrai levier, et la courbe de coût se voit tout de
  suite dans les résultats, d'où les alertes du deck builder (§7.1).
- **Le deck lourd** (moyenne de coût 3,8) reste faible (39 %) : avec 21 de capital sur la partie, il pose
  6 cartes quand les autres en posent 7. C'est le prochain chantier d'équilibrage (voir décisions
  ouvertes : un contexte « Investiture » qui donne +1 capital, ou une Envergure +6 à 6).
- **Rareté neutre** : toutes les raretés gagnent entre 49,7 et 50,7 %. Le coût moyen monte avec la rareté
  (une rare est plus riche, donc un peu plus chère), mais une carte n'est jamais plus forte à coût égal.
  La v1 donnait 37 % aux mythiques et 54 % aux communes.
- **Retournements** : le joueur qui mène après le tour 4 perd plus d'une partie sur trois ; Sursaut,
  Discret et le dernier tour à 6 de capital laissent la partie ouverte jusqu'au bout.
- **Pas d'avantage au premier joueur** : l'initiative revient au joueur qui mène, ce qui équilibre
  naturellement (49,6 %).
- **Collection** : un joueur qui choisit son deck parmi 30 à 120 cartes gagne ~47 % contre un joueur qui
  choisit parmi 500 ; l'écart est faible parce que le coût équilibre les cartes, et c'est voulu (pas de
  pay-to-win). Il existe néanmoins, d'où la tranche de collection de l'appariement (§5.2).
- **Figures sensibles** : Mao Zedong (s1-029) fait partie des 20 cartes hors bruit (côté fort) ; aucune
  carte sensible n'est dans les 8 plus fortes. La correction passe par le même autotune, sans traitement
  particulier.

### 4.4 Journal de réglage
Chaque ligne change **une** règle par rapport à la v2.0 ; mêmes graines, IA « normal », 3 000 parties
d'archétypes mélangés et 6 000 parties de decks « courbe » pour l'écart-type des cartes.


| Variante | Cartes jouées / joueur | rapide | lourd | délégation | compatriotes | histoire | valeur brute | Écart-type cartes |
|---|---|---|---|---|---|---|---|---|
| v2.0 (retenue) | 6.8 | 47.7 % | 35.7 % | 56.2 % | 63.6 % | 53.5 % | 58.8 % | 3.5 pts |
| sans Envergure | 6.8 | 52.4 % | 36.2 % | 61.2 % | 63.8 % | 53.4 % | 60.0 % | 3.6 pts |
| 4 cartes par territoire | 6.9 | 66.5 % | 32.0 % | 53.9 % | 62.6 % | 52.5 % | 57.7 % | 3.6 pts |
| capital = tour + 1 | 7.7 | 18.5 % | 49.1 % | 56.0 % | 62.0 % | 49.4 % | 62.3 % | 3.8 pts |
| Délégation +2, Compatriotes dès 2 cartes | 6.8 | 45.6 % | 34.2 % | 61.7 % | 69.6 % | 54.7 % | 56.9 % | 3.6 pts |
| effets limités au territoire de leur stat (v1) | 6.8 | 40.6 % | 41.2 % | 60.6 % | 60.6 % | 49.3 % | 54.1 % | 3.5 pts |
| sans contextes | 6.9 | 54.1 % | 32.3 % | 62.7 % | 62.5 % | 52.7 % | 60.3 % | 3.6 pts |
| sans signatures | 6.7 | 41.9 % | 40.4 % | 59.9 % | 59.8 % | 52.6 % | 58.4 % | 3.3 pts |

Ce que le réglage a appris, dans l'ordre où on l'a fait (chaque étape a été simulée sur 2 500 à
4 000 parties d'archétypes mélangés) :
1. **Délégation et Compatriotes cumulés** (+3 / +2 par paire) faisaient monter les decks d'un pays à
   65–71 % : on ne garde plus que le meilleur des deux par territoire, Délégation descend à +1 et
   Compatriotes demande un territoire complet du même pays (+2). Les mots-clés Alliance et Ouverture
   portent déjà une bonne part de la synergie de continent : sans aucun bonus de coalition, le deck
   d'un pays reste à ~60 %.
2. **Avec 4 emplacements par territoire**, le deck rapide pose 9 cartes et la quantité gagne (66 %
   ci-dessus) ; le barème d'Envergure n'y change presque rien (essais jusqu'à +8 à 6). Sans barème, les
   decks lourds tombaient même sous 25 %. Avec 3 emplacements, le barème freine surtout le deck rapide
   (52 → 48 %).
3. **3 emplacements par territoire** (au lieu de 4) équilibrent rapide et lourd, et rendent le plateau
   lisible sur un téléphone. **Capital = tour + 1** inverse le problème (rapide à 18,5 %).
4. Deux mots-clés étaient **impossibles ou toujours vrais** une fois traduits : Tempo « manche 1 » sur une
   carte à 3 (jamais jouable aux tours 1–2) et Outsider « coûte au moins autant » sur une carte à 1
   (toujours vrai). Fenêtres de Tempo et Outsider dépendent maintenant du coût, et le validateur §3.4
   empêche le retour du problème.
5. **Le verrou de stat du v1** (« +2 en Charisme » ne marche que sur l'Opinion) laissait les mots-clés
   actifs pour 30 % des cartes seulement. Sans verrou : ~60 %, au-dessus de la cible de 50 % de la revue,
   pour un équilibre comparable.
6. Les **probabilités de condition** de la formule de valeur sont remplacées par les taux d'activation
   mesurés, puis la **compensation d'Envergure** lisse les écarts dans une même tranche de coût.
7. `--autotune` (4 itérations de 20 000 parties, puis 2 de 40 000) corrige 318 valeurs de ±1,7 au plus.
   Avant correction, l'écart réel entre cartes était d'environ ±1,8 point (2,7 mesuré pour 2,0 de bruit
   sur 15 000 parties) ; après, d'environ ±1,3 point (1,8 mesuré pour 1,2 de bruit sur 40 000 parties).

Limite connue : le deck « valeur brute » (les 3 % de cartes les mieux notées à chaque coût) reste parmi
les meilleurs. C'est normal dans un jeu de cartes (les meilleures cartes de chaque coût existent), mais
il demande de posséder ces cartes précises. Les decks de synergie font jeu égal en construisant avec ce
qu'on a. À suivre en production avec les vraies données (§4.5).

### 4.5 Processus continu
- En CI : `simulate.py --quick` sur chaque modification de `data/` ou de `scripts/duel-sim/` ; échec si un
  critère du §4.1 est violé.
- En production : mêmes métriques sur les vraies parties (taux de victoire par carte incluse, par
  mot-clé, par rareté, par initiative), tableau hebdomadaire. Un écart réel > 4 points sur une carte jouée
  plus de 2 000 fois déclenche un correctif de valeur, publié avec la saison suivante (jamais en cours de
  saison classée, sauf urgence).

---

## 5. PvP

### 5.1 Modes
| Mode | Déblocage | Surenchère | Classement | Récompenses |
|---|---|---|---|---|
| Contre l'IA (facile, normal, difficile) | Après le tutoriel | Non | Non | Oui, dans le plafond quotidien |
| Occasionnel (PvP) | Niveau 5 ou 3 victoires contre l'IA | Non | MMR occasionnel caché | Oui, dans le plafond |
| Classé (PvP) | Niveau 10 et 25 cartes différentes | Oui | Voix, rangs, MMR caché | Plafond + fin de saison |
| Défi d'ami | Ami depuis 24 h (pas 7 jours : pas d'échange de cartes en jeu) | Optionnelle, pour l'honneur | Non | Aucune (anti-farm), mission hebdo « défier un ami » |

### 5.2 Appariement (par niveau, collection et MMR)
Le joueur entre en file avec un deck validé. Le serveur garde une file par mode, parcourue chaque
seconde, du plus ancien au plus récent ; chacun est apparié au candidat compatible le moins « cher »
(`|ΔMMR| + 60·|Δtranche de niveau| + 40·|Δtranche de collection|`).

**Critères (tous mutuels : chaque joueur doit accepter l'autre avec sa propre fenêtre)**
| Critère | Règle |
|---|---|
| MMR (Glicko-2, caché) | Fenêtre de ±60 au départ, +20 par seconde d'attente, plafond ±400 |
| Tranche de niveau (`player_progress.level`) | N1 : 1–9, N2 : 10–19, N3 : 20–34, N4 : 35+. Même tranche ; tranche voisine après 8 s. **Jamais N1 contre N3 ou N4**, quelle que soit l'attente |
| Tranche de collection (cartes différentes possédées) | C1 < 80, C2 80–199, C3 200–349, C4 ≥ 350. Même tranche ; voisine après 5 s |
| Protection des nouveaux | Les 5 premières parties PvP (« matchs d'investiture ») ne croisent que d'autres joueurs protégés, sinon un fantôme après 10 s |
| Revanche | Pas le même adversaire deux fois de suite en 10 min ; pas plus de 3 parties classées par 24 h pour une même paire (anti-arrangement) |
| Mode | Classé et occasionnel ont des files et des MMR séparés |

Pourquoi la collection : le simulateur (§4.2, « Effet de la taille de collection ») montre un écart
réel mais faible (~47 % pour un joueur qui choisit parmi 30 à 120 cartes contre un joueur qui choisit
parmi 500). Ce n'est pas du pay-to-win (une carte n'est pas plus forte qu'une autre à coût égal), c'est
de la liberté de construction : les decks de synergie complets demandent de l'ampleur. La tranche de
collection évite surtout qu'un nouveau tombe sur un vétéran au deck rodé, ce qui se *ressent* comme
injuste même quand l'écart est faible.

**MMR initial** : 1 000 en occasionnel ; en classé, 1 000 + 40 × (MMR occasionnel − 1 000) / 100, borné à
[900, 1 150]. Glicko-2 avec RD initial 250, ce qui fait converger en ~15 parties.

**Fantôme si personne** : après **18 s** en classé, **15 s** en occasionnel (10 s pour un joueur
protégé), le joueur affronte un **fantôme**.

### 5.3 Fantômes
- **Ce que c'est** : un deck réellement joué par un autre joueur dans une partie classée ou occasionnelle
  (instantané pris à chaque victoire, au plus un par joueur et par jour), piloté par l'IA.
- **Étiquette** : « Fantôme — cabinet de *Pseudo*, joué par l'IA », avec une icône distincte, dès l'écran
  d'appariement et pendant toute la partie. On ne fait jamais passer un fantôme pour un humain.
- **Choix** : même mode, même tranche de niveau, tranche de collection ±1, instantané de moins de 14 jours ;
  parmi les 5 plus proches en MMR (MMR du propriétaire au moment de l'instantané), un au hasard ; jamais
  son propre deck ni un des 20 derniers fantômes rencontrés. Pour un joueur protégé : uniquement des
  fantômes de tranche N1 et une IA « facile ».
- **Pilote** : IA « normale » ; « difficile » si le MMR du fantôme dépasse celui du joueur de plus de 150.
- **Effet sur le classement** : Voix normales (le fantôme ne prend pas de Surenchère, il surenchérit selon
  une règle simple de l'IA) ; MMR mis à jour avec un poids de 0,5 contre le MMR du fantôme.
- **Propriétaire** : notification groupée « Votre cabinet a gagné 3 parties en fantôme », +5 Influence par
  victoire de son fantôme, plafonné à 25 par jour. C'est un crochet de retour, pas une source de revenus.
- Démarrage du jeu (aucun fantôme réel) : un pool de 200 fantômes « maison » construits par le script des
  decks thématiques, étiquetés « Fantôme — cabinet MANDAT ».

Simulation de la file (`queue_sim.py`, 1 h simulée, 60 % en classé, population répartie entre les
tranches de niveau comme une base jeune) :

| Joueurs de duel connectés | Attente médiane | Attente P90 | Parties contre un fantôme | Écart MMR moyen (PvP) | PvP entre tranches de niveau voisines | Tranche de collection différente |
|---|---|---|---|---|---|---|
| 20 | 15 s | 18 s | 70 % | 121 | 55 % | 41 % |
| 50 | 12 s | 18 s | 41 % | 111 | 36 % | 37 % |
| 150 | 8 s | 16 s | 18 % | 96 | 27 % | 36 % |
| 500 | 5 s | 12 s | 5 % | 76 | 15 % | 26 % |
| 2000 | 2 s | 8 s | 1 % | 53 | 4 % | 12 % |

Lecture : sous ~150 joueurs de duel connectés en même temps, une partie sur cinq au moins se joue
contre un fantôme ; c'est le régime de lancement et la raison d'être des fantômes. Au-delà de 500, presque
tout est en PvP, à moins de 15 s. Aucun match N1 contre N3/N4 par construction.

### 5.4 Classement (ligue de saison)
- Rangs visibles : **Conseiller** III → II → I → **Ministre** III → II → I → **Chef d'État** III → II → I →
  **Légende**. 20 Voix par division : il faut 180 Voix nettes pour atteindre Légende.
- Paliers protégés : une fois Ministre III ou Chef d'État III atteint, on ne redescend plus sous ce palier
  pendant la saison.
- **Légende** : classement par MMR (top 500 affiché), mis à jour toutes les 5 minutes.
- **Saison** : 98 jours, alignée sur le passe (`BUSINESS.md` §5.7, dont la liste des ligues est à mettre à
  jour : Bronze…Platine devient Conseiller…Légende). Remise à zéro partielle : −4 divisions, au plus bas
  Conseiller I ; MMR tiré vers 1 000 de 30 %.
- **Récompenses de fin de saison** (aucune carte, aucun booster) : un cosmétique par rang atteint (dos de
  carte, cadre de vitrine, emote) et de l'Influence (Conseiller 100, Ministre 300, Chef d'État 600, Légende
  1 000).

### 5.5 Récompenses quotidiennes
Conforme à la P0-1 de la revue, déjà en place côté API (`RewardLimits.DUEL_WIN_REWARDS_PER_DAY = 5`) :
**5 victoires récompensées par jour, tous modes de duel confondus** ; une fois le plafond atteint, plus
aucun duel ne rapporte d'Influence ce jour-là.
| Résultat | Influence | XP |
|---|---|---|
| Victoire IA facile / normale / difficile | 10 / 20 / 30 | 20 / 30 / 40 |
| Victoire PvP ou fantôme | 30 | 50 |
| Défaite PvP (3 premières du jour, tant que le plafond n'est pas atteint) | 5 | 15 |
| Première victoire du jour (bonus) | +50 | +50 |
| Au-delà du plafond | 0 | XP réduite à 25 % |

Pas de booster gagné en duel : les boosters liés au duel passent par les missions existantes
(« Gagne 3 duels »). Crochets de missions : « Gagne un territoire avec une Délégation », « Joue 2 cartes
Discret », « Gagne une partie à 4 Voix ou plus », « Bats un fantôme », « Défie un ami ». Compteur visible
« 3/5 victoires récompensées aujourd'hui ».

### 5.6 Déconnexions, abandons, triche
- **Déconnexion** : le chrono continue. Une phase sans soumission = tour passé. Le joueur a **60 s cumulées**
  de déconnexion par partie pour revenir ; au-delà, ou après 2 phases manquées d'affilée, il **perd par
  forfait** : défaite au double de l'enjeu courant (8 maximum), comme s'il s'était retiré au pire moment.
  L'adversaire voit « Adversaire déconnecté (45 s) ».
- **Abandon volontaire** = « Se retirer » (§2.7).
- **Pénalité** : 3 forfaits en 24 h → 10 min sans accès à la file ; 6 → 1 h.
- **Redémarrage serveur** : les parties actives sont reconstruites depuis leur journal d'événements
  (§8.3) ; la phase en cours redémarre avec un chrono plein. Si la reconstruction échoue : partie annulée,
  aucun effet sur le classement.
- **Serveur autoritaire** : le client n'envoie que des intentions (« je pose ces cartes là »). Le serveur
  vérifie possession, deck validé, main, coût, capital, emplacements, territoire ouvert, tour et
  numéro de séquence ; toute soumission invalide est refusée en bloc avec un code d'erreur.
- **Pas d'information cachée envoyée en avance** : jamais la main ni l'ordre du deck adverses, jamais les
  poses adverses avant la révélation (seulement « l'adversaire a validé »), une carte Discret n'est
  envoyée que sous la forme `{hidden: true, cost}`, jamais la graine. Le deck adverse n'est connu que
  carte par carte, au fil des révélations.
- **Limites de débit** : 10 entrées en file par minute, 20 messages par seconde par socket, 1 socket active
  par compte (une nouvelle connexion ferme l'ancienne), tickets de connexion à usage unique valables 60 s.
- **Arrangements** : alertes sur les paires qui se rencontrent souvent, les retraits immédiats répétés
  entre deux comptes, les comptes récents à fort taux de victoire contre un même adversaire.

---

## 6. IA solo
Même moteur, mêmes règles, même chrono que le PvP (l'IA « réfléchit » 1 à 3 s pour la mise en scène).

| Niveau | Pilote | Deck adverse |
|---|---|---|
| Facile | `normal`, mais un tour sur trois au hasard | Deck thématique de qualité 0,3 |
| Normal | `normal` (meilleur sous-ensemble + placement glouton) | Deck thématique de qualité 0,6 |
| Difficile | `hard` (plans candidats + rollouts déterminisés) | Deck thématique de qualité 0,8 |

- Les decks de l'IA sont des **decks thématiques nommés** tirés du catalogue complet (revue §4.2) : la
  difficulté vient de l'IA et de la qualité du deck, **pas** des stats du joueur. La collection du joueur
  compte donc enfin.
- Mesures (§4.2) : « normal » bat « facile » à 66 %, « difficile » bat « normal » à 67 % et « facile »
  à 75 % ; un joueur qui pose au hasard ne gagne que 9 à 30 % de ses parties.
- Coût serveur : l'IA « hard » simule ~70 parties partielles par tour. En Java, c'est quelques
  millisecondes ; un budget dur de 50 ms coupe les rollouts si besoin.
- L'IA reçoit uniquement une `PlayerView` (§8.2), donc le typage empêche qu'elle lise l'information
  cachée.

---

## 7. UX

### 7.1 Deck builder (« Cabinets »)
- **Liste des cabinets** : 10 emplacements gratuits, nom (24 caractères, modéré), carte de couverture,
  courbe de coût miniature, badges de synergie (« Délégation Europe ×5 », « Compatriotes GB ×2 »),
  dernier taux de victoire. Actions : jouer, modifier, dupliquer, supprimer, **copier le code**
  (`MANDAT2-…`, base32 des numéros de cartes) pour un ami.
- **Éditeur** : grille de la collection en haut, barre du cabinet en bas (10 emplacements, toujours
  visibles).
  - **Filtres** (chips cumulables) : rareté, continent, ère, pays (recherche), coût 1–6, mot-clé,
    signature, type d'effet (Soutien/Pression/Véto), stat minimale (curseur par stat).
  - **Tri** : coût, puissance max (stat max + Envergure), Influence, Diplomatie, Charisme, Stratégie,
    nom, numéro, date d'obtention ; ordre croissant/décroissant.
  - **Recherche** plein texte : nom, rôle, pays.
  - Chaque vignette montre coût, 4 stats, l'icône du mot-clé et de la signature ; appui long = fiche.
  - **Aides** : histogramme de coût avec repère « capital total 21 », alertes (« 38 de coût pour 21 de
    capital : cabinet trop lourd », « aucune carte à 1–2 », « 4 cartes Sommet seulement »), compteurs de
    synergie en direct.
  - **Construction automatique** : choisit le continent ou le pays où la collection offre le plus de
    synergie, remplit la courbe 1-1-2-2-3-3-4-4-5-6 avec les meilleures valeurs, puis montre ce qu'il a
    choisi et pourquoi (« Délégation Afrique : 6 cartes »). Le joueur peut figer des cartes avant de
    relancer.
- Fiche de carte (revue §7, ligne 9) : bloc « En duel » avec coût, Envergure, meilleur territoire,
  mot-clé expliqué et cabinets qui l'utilisent.

### 7.2 Parcours d'une partie
1. **Accueil Duel** : trois gros boutons (Contre l'IA, Occasionnel, Classé avec le rang), défis d'amis en
   attente, compteur de récompenses du jour.
2. **Choix du cabinet** (le dernier utilisé est présélectionné).
3. **Recherche** : chrono, tranche visée, bouton annuler ; à 18 s, transition « Aucun adversaire
   disponible, un fantôme prend le relais » (étiquette visible).
4. **Présentation** (3 s) : les deux joueurs (avatar, rang, niveau ; « Fantôme » le cas échéant), les
   3 territoires et leurs contextes qui se retournent un à un.
5. **Tours** : phase de jeu → validation → révélation animée → tour suivant.
6. **Fin** : territoires gagnés, Voix ±, MMR caché, récompenses (plafond affiché), « carte décisive »
   (jamais une carte sensible), boutons Revanche (ami/occasionnel), Rejouer, Partager.

### 7.3 Plateau (portrait)
```
┌───────────────────────────────┐
│ Adversaire · Ministre II · ✋5 │  main adverse (nombre), enjeu ×2
├─────────┬─────────┬───────────┤
│ [c][c]  │ [c]     │ [?][c][c] │  cartes adverses (3 max), ? = Discret
│  ── 14  │  ── 6   │  ≥ 11 ──  │  puissance adverse
│PARLEMENT│ SOMMET  │  OPINION  │  nom, icône de stat, contexte (pastille)
│ Crise   │ Calme   │  Tribune  │
│  ── 12  │  ── 9   │   15 ──   │  votre puissance (vert si vous menez)
│ [c][c]  │ [c][c]  │ [c][c][c] │  vos cartes
├─────────┴─────────┴───────────┤
│ Capital ●●●○○○ 3/4   ⏱ 24 s   │
│ [main en éventail : 4–7 cartes]│  glisser vers un territoire, tap = fiche
│ [Surenchérir]      [Valider ▶] │
└───────────────────────────────┘
```
- Sur une carte posée, **un seul nombre** : sa puissance actuelle ici (vert si bonus actif, rouge si
  pressée). Le détail s'ouvre au tap.
- Pendant la phase de jeu, les cartes posées ce tour sont translucides avec un « annuler » ; la puissance
  prévisionnelle est affichée en pointillé, calculée localement à partir des règles publiques (pratique,
  pas « optimiste » : rien n'est considéré comme joué avant la réponse du serveur).
- Cartes injouables grisées (coût > capital restant, territoire plein ou fermé).

### 7.4 Animations et retours
- Révélation : retournement carte par carte (0,8 s chacune, accélérable au tap), compteur de puissance qui
  défile (`CountUp` existant), haptique légère par carte, forte quand un territoire change de camp.
- Mot-clé qui s'active : pastille dorée qui pulse et texte court (« Alliance +2 »).
- Délégation/Compatriotes : liseré de couleur continentale qui relie les cartes.
- Pression : onde rouge vers le camp adverse ; Véto : sceau sur le territoire à égalité.
- Discret : carte retournée avec un sceau de cire ; révélation groupée au tour 6, ralentie (moment fort).
- Surenchère : enjeu qui tamponne « ×2 » au centre de l'écran à la révélation.
- Dernier tour : musique et vignette plus marquées, chrono rouge sous 5 s.
- Respecter « réduire les animations » du système (tout passe en fondus).

### 7.5 Tutoriel (3 parties scénarisées contre l'IA, decks fixes)
1. **« Un territoire »** : un seul territoire actif, on apprend capital et puissance.
2. **« Trois territoires »** : gagner 2 sur 3, l'initiative, un Sursaut qui retourne la situation.
3. **« Coalitions »** : Délégation, Pression, une carte Discret.
Puis, au déblocage du classé : écran court sur Surenchère et retrait, avec une partie d'essai contre un
fantôme. Chaque étape récompense (booster d'investiture au bout des 3).

---

## 8. Architecture technique

### 8.1 Vue d'ensemble
```
mobile (Expo) ──REST──► /api/v2/duel/...   (decks, historique, ticket, défis, classement)
       └──WebSocket──► /ws/duel?ticket=…   (file, partie)
API Spring Boot (instance unique Dokploy)
  duel.v2.engine   moteur pur, sans Spring
  duel.v2.match    MatchRegistry (en mémoire) + acteur par partie + journal d'événements
  duel.v2.queue    Matchmaker (tick 1 s) + GhostService
  duel.v2.rating   Glicko-2, Voix, saisons
  duel.v2.ai       pilotes easy/normal/hard (sur PlayerView)
Postgres           decks, parties, événements, classements, fantômes
```

### 8.2 Moteur (`com.mandat.api.duel.v2.engine`)
- Java pur, records immuables, aucune dépendance Spring ni horloge.
- `MatchState` (territoires, decks ordonnés, mains, plateau, tour, initiative, enjeu, statut).
- `Engine.start(MatchSetup setup, long seed) → List<Event>` ; `Engine.apply(MatchState, Command) →
  List<Event>` ; `MatchState.fold(Event)`. L'état est toujours la réduction des événements.
- Commandes : `SubmitPlays(side, turn, plays)`, `Raise(side, turn)`, `Retreat(side)`,
  `PhaseTimeout(turn)`, `Forfeit(side)`.
- Événements : `MatchStarted`, `TurnStarted(turn, capital, draws par camp)`, `PlaysSubmitted(side)`,
  `CardRevealed(side, cardId, territory, order, sursaut)`, `CardDrawn(side, cardId)` (Mobilisation),
  `StakesRaised`, `TurnResolved(powers)`, `MatchEnded(result, reason, stakes)`.
- Hasard : un `SplittableRandom(seed)` consommé dans un ordre fixe (territoires, contextes, mélange A,
  mélange B, tirage d'initiative). La graine est stockée, jamais envoyée.
- `PlayerView view(MatchState, side)` : seule entrée de l'IA et seule source des messages envoyés à un
  joueur. C'est là, et seulement là, que l'information cachée est filtrée.
- Profils de cartes : chargés depuis `data/duel/season1.json` (exporté par le simulateur) dans
  `DuelCardProfiles`, versionnés avec `catalog_versions`.
- **Tests de parité** : `simulate.py --golden golden.json` produit des parties complètes (ordre de pioche,
  initiative, territoires, poses, puissances finales, vainqueur) ; un test JUnit rejoue les poses dans le
  moteur Java avec le même ordre de pioche et compare puissances et résultat. Le simulateur reste la
  référence des règles.

### 8.3 Parties, journal et persistance (Flyway `V110__duel_v2.sql`, après `V101__economy_limits.sql`)
```sql
create table duel_decks (
  id uuid primary key, user_id uuid not null references users(id) on delete cascade,
  name text not null check (length(name) between 1 and 24),
  card_ids text[] not null check (cardinality(card_ids) = 10),
  cover_card_id text, is_default boolean not null default false,
  created_at timestamptz not null, updated_at timestamptz not null);
create index duel_decks_user_idx on duel_decks (user_id);

create table duel_matches (
  id uuid primary key,
  mode text not null check (mode in ('ai','casual','ranked','friend','tutorial')),
  status text not null check (status in ('active','finished','aborted')),
  seed bigint not null, rules_version text not null, catalog_version text not null,
  player_a uuid not null references users(id), player_b uuid references users(id),  -- null : IA ou fantôme
  ghost_id uuid, ai_level text, deck_a text[] not null, deck_b text[] not null,
  territories jsonb not null, stakes int not null default 1,
  result text check (result in ('a','b','draw')), end_reason text,
  voix_delta_a int, voix_delta_b int, mmr_delta_a real, mmr_delta_b real,
  -- plafond quotidien (même logique que duels.rewarded de V101) : Influence réellement versée
  rewarded_a boolean not null default false, reward_influence_a int, reward_capped_a boolean not null default false,
  rewarded_b boolean not null default false, reward_influence_b int, reward_capped_b boolean not null default false,
  created_at timestamptz not null, finished_at timestamptz);
create index duel_matches_rewarded_a_day on duel_matches (player_a, finished_at) where rewarded_a;
create index duel_matches_rewarded_b_day on duel_matches (player_b, finished_at) where rewarded_b;
create index duel_matches_player_a_idx on duel_matches (player_a, created_at desc);
create index duel_matches_player_b_idx on duel_matches (player_b, created_at desc);
create index duel_matches_active_idx on duel_matches (status) where status = 'active';

create table duel_match_events (
  match_id uuid not null references duel_matches(id) on delete cascade,
  seq int not null, type text not null, payload jsonb not null, at timestamptz not null,
  primary key (match_id, seq));

create table duel_seasons (id int primary key, starts_at timestamptz not null, ends_at timestamptz not null);

create table duel_ratings (
  user_id uuid not null references users(id) on delete cascade,
  season_id int not null references duel_seasons(id), mode text not null check (mode in ('casual','ranked')),
  mmr real not null, rd real not null, volatility real not null,
  voix int not null default 0, best_voix int not null default 0,
  matches int not null default 0, wins int not null default 0, protected_left int not null default 5,
  updated_at timestamptz not null, primary key (user_id, season_id, mode));
create index duel_ratings_ladder_idx on duel_ratings (season_id, mode, mmr desc);

create table duel_ghosts (
  id uuid primary key, user_id uuid references users(id) on delete cascade,  -- null : fantôme maison
  mode text not null, deck_card_ids text[] not null, deck_name text not null,
  mmr real not null, level_bracket smallint not null, collection_bracket smallint not null,
  created_at timestamptz not null, uses int not null default 0, wins int not null default 0);
create index duel_ghosts_pick_idx on duel_ghosts (mode, level_bracket, mmr);

create table duel_challenges (
  id uuid primary key, from_user uuid not null references users(id) on delete cascade,
  to_user uuid not null references users(id) on delete cascade, from_deck_id uuid not null,
  status text not null check (status in ('pending','accepted','declined','expired','played')),
  match_id uuid, created_at timestamptz not null, expires_at timestamptz not null);
```
- Le plafond de 5 victoires récompensées par jour réutilise `RewardLimits.DUEL_WIN_REWARDS_PER_DAY` et
  compte **ensemble** `duels.rewarded` (v1, tant qu'elle existe) et `duel_matches.rewarded_*`. L'Influence
  des fantômes passe par `wallet_ledger` avec une source `duel_ghost`, plafonnée par une somme du jour.
- Les événements sont écrits **avant** l'envoi aux clients (une transaction courte par lot d'événements
  d'une commande). Une partie pèse ~60 événements.
- L'ancienne table `duels` reste pour la v1 tant qu'elle existe.

### 8.4 REST (`/api/v2/duel`, OpenAPI, types générés côté mobile comme aujourd'hui)
| Méthode | Chemin | Corps / réponse |
|---|---|---|
| GET | `/decks` | `DeckDto[]` |
| POST | `/decks` | `DeckUpsertRequest{name, cardIds[10], coverCardId?}` → `DeckDto` |
| PUT | `/decks/{id}` | idem |
| DELETE | `/decks/{id}` | 204 |
| POST | `/decks/validate` | `{cardIds}` → `DeckValidationDto{valid, errors[], totalCost, curve[6], synergies[]}` |
| POST | `/decks/auto` | `{lockedCardIds[], theme?}` → `DeckUpsertRequest` proposé |
| GET | `/profiles` | `CardDuelProfileDto[]` (coût, Envergure, mot-clé, paramètres, signature) + `rulesVersion` |
| POST | `/ws-ticket` | → `{ticket, expiresAt}` (usage unique, 60 s) |
| POST | `/ai-matches` | `{deckId, level}` → `{matchId}` puis tout se passe en WebSocket |
| GET | `/matches?cursor=` | historique `MatchSummaryDto[]` |
| GET | `/matches/{id}` | `MatchReplayDto` (journal complet une fois la partie finie) |
| GET | `/rating` | `RatingDto{mode, tier, division, voix, legendRank?, seasonEndsAt, protectedLeft}` |
| GET | `/ladder?mode=ranked` | top Légende |
| POST | `/challenges` | `{friendUserId | friendCode, deckId}` → `ChallengeDto` |
| POST | `/challenges/{id}/accept` | `{deckId}` → `{matchId}` |
| POST | `/challenges/{id}/decline` | 204 |
| GET | `/rewards/today` | `{rewardedWins, cap: 5, firstWinClaimed}` |

`DeckDto{id, name, cardIds[], coverCardId, isDefault, totalCost, curve[6], synergies[{kind, key, count}],
valid, invalidReasons[], updatedAt}`.

### 8.5 Protocole WebSocket
Connexion `wss://…/ws/duel?ticket=…` (WebSocket brut Spring `spring-boot-starter-websocket`, pas STOMP :
plus simple à piloter depuis React Native). Messages JSON `{type, …}` ; chaque message serveur porte un
`seq` croissant par partie (ou 0 hors partie). Les messages client portent un `cid` (identifiant
client) pour l'idempotence.

Client → serveur :
| type | champs |
|---|---|
| `queue.join` | `mode: casual|ranked`, `deckId` |
| `queue.leave` | — |
| `match.join` | `matchId` (partie IA ou défi créé en REST) |
| `match.submit` | `matchId`, `turn`, `plays: [{cardId, territory: 0|1|2}]` (ordre = ordre de révélation) |
| `match.raise` | `matchId`, `turn` |
| `match.retreat` | `matchId` |
| `match.ready` | `matchId`, `seq` (fin d'animation) |
| `match.resume` | `matchId`, `lastSeq` |
| `match.emote` | `matchId`, `emoteId` (liste fermée, 1 toutes les 5 s) |
| `ping` | `t` |

Serveur → client :
| type | champs |
|---|---|
| `welcome` | `userId`, `serverTime`, `activeMatchId?` |
| `queue.status` | `mode`, `waitedSec`, `phase: searching|widening|ghost` |
| `match.found` | `matchId`, `side`, `opponent{displayName, level, tier, avatarId, kind: human|ghost|ai, ghostOf?}`, `territories[{index, domain, context}]`, `rulesVersion` |
| `turn.start` | `turn`, `capital`, `deadline` (ISO, horloge serveur), `hand[]` (ids), `drawn?`, `deckCount`, `opponentHandCount`, `opponentDeckCount`, `stakes` |
| `turn.ack` | `turn`, `accepted: true`, ou `error` |
| `turn.opponentSubmitted` | `turn` |
| `turn.reveal` | `turn`, `initiative`, `reveals[{side, order, territory, card: {id} | {hidden: true, cost}, sursaut}]`, `drawn?` (Mobilisation, au propriétaire), `territories[{power: [mine, theirs], theirsIsMinimum, winner?, activeKeywords[]}]`, `stakes`, `pendingRaise?` |
| `match.opponentStatus` | `connected`, `graceLeftSec` |
| `match.snapshot` | état complet de la `PlayerView` (après `resume`) + `seq` |
| `match.end` | `result: win|loss|draw`, `reason: complete|retreat|forfeit|aborted`, `finalBoard` (tout révélé), `stakes`, `voixDelta`, `rating{tier, division, voix}`, `rewards{influence, xp, capped}`, `decisiveCardId?` |
| `match.emote` | `side`, `emoteId` |
| `error` | `code` (`INVALID_PLAYS`, `NOT_YOUR_TURN`, `RATE_LIMITED`, `DECK_INVALID`, `MATCH_NOT_FOUND`…), `message` |
| `pong` | `t`, `serverTime` |

Cadence : le serveur ouvre une phase (`turn.start`), attend les deux `match.submit` ou l'échéance, envoie
`turn.reveal`, puis attend les deux `match.ready` au plus *1,5 s + 0,8 s × cartes révélées + 3 s* avant le
tour suivant. Heartbeat client toutes les 15 s ; le serveur ferme une socket muette depuis 45 s.

### 8.6 Exécution et montée en charge (une instance Dokploy)
- **Acteur par partie** : chaque partie a sa file de commandes traitée séquentiellement (exécuteur à
  thread virtuel), donc pas de verrou dans le moteur. Timers par `ScheduledExecutorService`.
- **Matchmaker** : un seul thread, tick de 1 s, files en mémoire ; l'entrée en file est refusée si le
  joueur a déjà une partie active (il est renvoyé vers `match.resume`).
- **Mémoire** : ~50 Ko par partie active ; 2 000 parties simultanées ≈ 100 Mo. Le trafic est minuscule
  (~60 messages par partie).
- **Proxy** : Traefik (Dokploy) gère WebSocket ; délai d'inactivité ≥ 120 s.
- **Déploiements** : drapeau « maintenance duel » 5 min avant : plus d'entrée en file, les parties finissent.
  Au démarrage, reprise des parties `active` depuis `duel_match_events`.
- **Plus tard (plusieurs instances)** : routage collant par `matchId`, file d'attente et présence dans
  Redis ou Postgres `LISTEN/NOTIFY`. Rien dans le moteur ne change.

### 8.7 Mobile
- `src/features/duel2/` : `protocol.ts` (types des messages, écrits à la main et testés contre les
  fixtures du serveur), `socket.ts`, `store.ts` (zustand), `reducer.ts`, écrans `DeckList`, `DeckEditor`,
  `Queue`, `Board`, `End`, `Tutorial`.
- **Machine à états** (`reducer(state, serverMessage)` pur et testé) :
  `idle → queueing → matchFound → planning(turn) → submitted → revealing → planning(turn+1) … → ended`,
  avec deux surcouches : `reconnecting` (socket perdue) et `opponentDisconnected`.
- **Client socket** : ticket REST → connexion → `welcome` ; si `activeMatchId`, `match.resume` avec le
  dernier `seq` connu. Reconnexion à 0,5 / 1 / 2 / 4 / 8 s puis toutes les 8 s jusqu'à 60 s ; reprise au
  retour au premier plan (`AppState`). Les envois de `match.submit` sont idempotents (`matchId` + `turn`).
- **Aucune UI optimiste** : la pose est un brouillon local, la vérité est `turn.ack`/`turn.reveal`. Les
  puissances prévisionnelles du brouillon sont marquées comme telles.
- Le chrono affiché part de `deadline` corrigée du décalage mesuré par `ping/pong`.
- Les profils de cartes (`/profiles`) sont mis en cache avec le catalogue (React Query persistant).

---

## 9. Plan de mise en œuvre

Deux lots en parallèle, ~3 semaines chacun, avec un contrat figé au jour 2 (DTO REST dans OpenAPI, schéma
des messages WebSocket ci-dessus, fixtures JSON issues de `--golden`).

### Lot A — API : moteur, IA, PvP (≈ 16 j)
| # | Tâche | Jours |
|---|---|---|
| A1 | Profils de cartes (`data/duel/season1.json`, chargement, validateur d'atteignabilité, test) | 1 |
| A2 | Moteur pur + `PlayerView` + tests unitaires des règles + parité `--golden` | 4 |
| A3 | IA easy/normal/hard sur `PlayerView`, decks thématiques, budget 50 ms | 2 |
| A4 | REST decks (CRUD, validation, auto-build), profils, ticket WS | 1,5 |
| A5 | WebSocket : sessions, auth par ticket, acteur de partie, timers, journal, reprise, forfaits | 3 |
| A6 | Matchmaker (règles §5.2), fantômes (instantanés, choix, pool maison), file occasionnelle/classée | 2 |
| A7 | Glicko-2, Voix, rangs, paliers, saisons, classement Légende | 1,5 |
| A8 | Récompenses plafonnées, missions, défis d'ami, limites de débit, métriques d'équilibrage | 1 |

### Lot B — Mobile : cabinets, plateau, appariement (≈ 15 j)
| # | Tâche | Jours |
|---|---|---|
| B1 | `protocol.ts`, `reducer.ts` (tests sur fixtures), `socket.ts` avec reconnexion | 2,5 |
| B2 | Cabinets : liste, éditeur, filtres, tris, recherche, alertes, auto-build, code de partage | 3,5 |
| B3 | Plateau portrait : main, glisser-déposer, brouillon, chrono, Surenchère, retrait | 3,5 |
| B4 | Révélation et animations (§7.4), haptique, « réduire les animations » | 2 |
| B5 | Accueil duel, recherche/fantôme, présentation, écran de fin, rang | 1,5 |
| B6 | Tutoriel en 3 parties, i18n fr/en des mots-clés/contextes | 2 |

Avant que A5 soit prêt, B utilise un faux serveur local : le reducer et le plateau se développent sur les
fixtures `--golden` rejouées par un petit lecteur de journal.

### Tests d'acceptation
**Moteur et règles**
- Les 5 parties `--golden` donnent les mêmes puissances finales et le même vainqueur en Java.
- Chaque mot-clé a un test « actif » et « inactif » ; Tempo et Outsider sont actifs au moins dans un cas
  pour chaque coût ; le validateur refuse un Spécialiste sur une autre stat.
- Capacité : une soumission dépassant le capital, un territoire plein ou fermé, une carte hors main ou un
  doublon est refusée en bloc.
- Initiative : le meneur révèle en premier ; à égalité, alternance ; Sursaut calculé juste avant la
  révélation de la carte.
- Discret : l'adversaire ne reçoit jamais l'id avant `match.end` (test sur tous les messages émis).
**PvP**
- Deux clients de test jouent une partie complète ; un client coupé 30 s puis revenu reçoit
  `match.snapshot` et continue ; coupé 61 s, il perd par forfait au double de l'enjeu.
- Redémarrage de l'API au tour 3 : la partie reprend au tour 3 avec les mêmes mains.
- Un joueur N1 n'est jamais apparié à un N3/N4 (test de propriété sur 10 000 tirages du matchmaker) ;
  un joueur protégé ne rencontre que des protégés ou des fantômes N1.
- Fantôme après 18 s en classé, étiqueté `kind: ghost` ; jamais son propre deck.
- Plafond : la 6e victoire du jour ne donne pas d'Influence ; le compteur l'affiche.
- 20 messages/s au-delà : `RATE_LIMITED`, la socket reste ouverte ; 3 forfaits en 24 h : file bloquée 10 min.
**Mobile**
- Le reducer reproduit l'état final de chaque fixture ; aucune action n'est affichée comme jouée avant
  `turn.ack`.
- Deck builder : filtrer « Afrique + coût ≤ 2 + Alliance », trier par Stratégie décroissante, sauvegarder,
  rouvrir : même résultat ; un cabinet de 9 cartes ne peut pas être sauvegardé comme valide.
- Plateau lisible à 360 × 640 pt : 3 cartes par camp par territoire sans chevauchement, texte ≥ 12 pt.
- Partie complète contre l'IA en moins de 4 min avec des décisions rapides.

---

## 10. Décisions ouvertes (pour toi)
1. **Surenchère en classé** : on la garde (bluff, retrait) ou on classe au simple résultat ? Elle double
   la profondeur stratégique mais ajoute une règle et une frustration (« il s'est retiré »).
2. **Contextes visibles dès le début** (proposé, plus lisible) ou révélés un par tour comme Snap (plus
   de surprise, plus dur à suivre) ?
3. **Défi d'ami pour tous** (proposé) alors que `BUSINESS.md` §5 le rangeait dans le Premium avec decks
   personnalisés : il faut trancher ; mon avis : gratuit, c'est la boucle sociale la moins chère.
4. **Seuils de déblocage** : PvP occasionnel au niveau 5, classé au niveau 10 et 25 cartes. Plus tôt ?
5. **Fantômes au lancement** : accepter qu'une majorité de parties soient contre des fantômes tant qu'on a
   moins de ~150 duellistes connectés (la file le montre), ou réserver le PvP à des créneaux (« heure du
   Parlement » quotidienne) pour concentrer les joueurs ?
6. **Noms des rangs** : Conseiller → Ministre → Chef d'État → Légende (demandé) à reporter dans
   `BUSINESS.md` §5.7 (qui dit Bronze → Platine → « Chef d'État »).
7. **Renommer les 9 capacités sensibles** listées au §2.9 dès maintenant (elles restent visibles dans la
   collection) ou se contenter du masquage en duel.
8. **Retrait du duel v1** : remplacement direct (proposé) ou v1 conservé un temps comme « Duel éclair ».
9. **Deck lourd** (39 % en simulation) : on l'accepte comme « mauvaise courbe » signalée par le deck
   builder, ou on ajoute un levier (contexte « Investiture » : +1 capital au tour 6 ; ou Envergure +6 à
   coût 6) à valider au simulateur ?
10. **Compatriotes** à 61–64 % : garder ce niveau (c'est la synergie la plus « fantasme » : un cabinet
   100 % britannique) ou le ramener sous 60 % en retirant le bonus de coalition et en ne gardant que les
   mots-clés Alliance/Ouverture ?
