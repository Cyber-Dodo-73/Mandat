# MANDAT — Checklist de lancement App Store (iOS d'abord, Android ensuite)

Version du 2026-10-19, mise à jour le même jour après le lot « bloquants de lancement » (B4 à B9, B12, S1 partiel,
S2). Audit initial du dépôt (commit `da46b16`, build TestFlight 0.1.0) et de l'API de production. Ce document n'est pas un avis juridique : les lignes marquées ⚖️ passent
par un avocat.

Légende : ✅ fait · ⚠️ partiel · ❌ manquant. **Qui** : dev (agent ou toi), user (toi : comptes, décisions,
textes, captures), lawyer (avocat), Apple (revue). **Effort** en jours (j) ou heures (h).

---

## Synthèse

L'app est techniquement avancée : auth email + Apple, suppression de compte, cotes affichées, filtre de pseudos,
signalement, crédits photo, i18n FR/EN complète, `usesNonExemptEncryption: false`, profil EAS `production`.
Il reste **trois familles de blocages** :

1. **Pièces à finaliser** : politique de confidentialité, CGU et mentions légales existent en brouillon FR/EN (servies
   par l'API et liées dans l'app) mais doivent être validées par un juriste ; restent le compte de démo, la
   déclaration de statut de « trader » DSA, les étiquettes de confidentialité, le questionnaire d'âge, les captures.
2. **Conformité dans le code : traitée** (révocation Sign in with Apple, blocage, outils de modération, manifeste de
   confidentialité, acceptation des CGU, mot de passe oublié, durcissement de la configuration de production). Il
   reste à fournir les secrets (clé Apple, SMTP, webhook) et à valider la suite de tests de l'API.
3. **Risque de contenu** (le principal risque de rejet et de presse) : Hitler et Staline mythiques, Goebbels épique,
   Eichmann et al-Baghdadi rares, avec de vraies photos ; 165 personnes vivantes, dont Poutine (mythique),
   Zelensky et Netanyahou en épique (règles 1.1.1, 1.1.7, droit à l'image). Il faut une décision produit
   documentée et un avis d'avocat avant la soumission publique.

Calendrier réaliste : **soumission vers le 6–10 novembre 2026, sortie publique vers le 20–30 novembre 2026**.
Le chemin critique, ce sont les textes juridiques et l'avis d'avocat, pas le code (détail en §5).

---

## 1. App Store Connect et règles de revue

| # | Point | État | Qui | Effort | Où / constat | À faire |
|---|---|---|---|---|---|---|
| 1.1 | **Nom de l'app** | ⚠️ | user | 1 h | Nom ASC actuel « MANDAT (6f5b32) » (nom provisoire, ASC exige un nom unique). Dans le binaire : `APP_NAME = 'MANDAT'` (`mobile/src/constants/app.ts`). | Choisir un nom définitif de 30 caractères max, sans nom de personnalité, par exemple « MANDAT : Cartes d'Histoire » ou « MANDAT – Figures de l'Histoire ». Le nom sous l'icône reste « MANDAT ». |
| 1.2 | Sous-titre (30 car.) | ❌ | user | 30 min | — | Par exemple « Collectionne l'Histoire » / « Collect history's leaders ». |
| 1.3 | Mots-clés (100 car.) | ❌ | user | 30 min | — | Mots génériques (cartes, collection, histoire, quiz, présidents, rois, culture générale, booster, TCG). **Aucun nom de politicien vivant** (2.3.7, BUSINESS §4.4, D10). |
| 1.4 | Langue principale | ❌ | user | 5 min | L'app détecte FR/EN (`expo-localization`). | Langue principale **Français**, plus une localisation **English (U.S.)** de la fiche (même nom, textes traduits). |
| 1.5 | Catégorie | ❌ | user | 5 min | BUSINESS §4.4 : positionnement « histoire et culture générale ». | Principale **Jeux**, sous-catégories **Cartes** et **Quiz/Trivia** ; secondaire **Éducation**. |
| 1.6 | **Questionnaire d'âge** (nouveau système 4+/9+/13+/16+/18+, obligatoire depuis le 31/01/2026) | ❌ | user | 30 min | Boosters gratuits à objets aléatoires (« loot boxes » sans achat), contenu historique (dictatures, guerres, génocides décrits factuellement), vraies photos de figures sensibles, pseudos visibles (interaction limitée). | Déclarer : loot boxes / objets aléatoires = **oui** ; jeu d'argent simulé = **non** (aucune mise, aucun gain convertible) ; violence = **rare / réaliste ou historique** (textes, pas d'images violentes) ; thèmes matures = **rares** ; contenu généré par les utilisateurs = **oui** (pseudos, profils). Viser **13+** (le résultat est calculé par Apple, on peut le relever, pas le baisser). Garder une copie des réponses dans `docs/`. |
| 1.7 | **Étiquettes de confidentialité** (App Privacy) | ❌ | user + dev | 1 h | Données collectées (voir §2.1) : email, ID utilisateur, pseudo, progression et collection, jeton push, langue et fuseau horaire, adresse IP dans les logs. Pas d'analytics, pas de crash reporting, pas de pub, pas de pistage. | Déclarer en « liées à l'utilisateur », finalité **Fonctionnalité de l'app** : *Coordonnées → Adresse e-mail* ; *Identifiants → ID utilisateur* (et *ID de l'appareil* pour le jeton push, par prudence) ; *Contenu utilisateur → Autre contenu* (pseudo, signalements) ; *Utilisation → Interactions avec le produit* (progression). **Pistage : non.** Si Sentry est ajouté (§3.3) : *Diagnostic → Données de plantage / performance*, non liées. |
| 1.8 | Manifeste de confidentialité (`PrivacyInfo.xcprivacy`, API à « raison requise ») | ✅ | dev | — | `ios.privacyManifests` dans `mobile/app.config.ts` : pas de pistage, `NSPrivacyAccessedAPITypes` UserDefaults `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1` (raisons relevées dans les manifestes de React Native et des modules Expo installés), `NSPrivacyCollectedDataTypes` : e-mail, ID utilisateur, contenu de jeu, ID d'appareil (jeton push), liés, finalité fonctionnalité, sans pistage. | Vérifier l'absence d'e-mail ITMS-91053 après l'envoi du build ; garder 1.7 cohérent. |
| 1.9 | Conformité export (chiffrement) | ✅ | — | — | `ios.config.usesNonExemptEncryption: false`, donc `ITSAppUsesNonExemptEncryption = NO`. L'app n'utilise que HTTPS, le trousseau (`expo-secure-store`) et `expo-crypto` (API système). MMKV est créé **sans** clé de chiffrement (`src/lib/storage.ts`) [4]. | Rien. Ne pas activer le chiffrement MMKV sans revoir ce point. |
| 1.10 | **Captures d'écran** | ❌ | user (dev peut aider) | 1 j | `supportsTablet: false`, donc pas de captures iPad. | 3 à 10 captures **iPhone 6,9"** (1320 × 2868 ou 1290 × 2796), qu'Apple réduit pour les autres tailles ; 6,5" (1284 × 2778) seulement en repli [5]. FR et EN. **Montrer des figures historiques du domaine public** (Cléopâtre, de Gaulle, Mandela, Lincoln…), jamais Hitler/Staline, ni une figure vivante sans accord (2.3.9 : « You are responsible for securing the rights to use all materials in your … screenshots ») [1]. |
| 1.11 | Aperçus vidéo (App Preview) | ❌ (facultatif) | user | 0,5 j | — | Post-lancement : une ouverture de booster de 15 à 30 s. |
| 1.12 | **URL de support** | ⚠️ | user | 1 h | ✅ L'API sert `/support` (FR/EN, `?lang=en`) avec l'e-mail de contact (`MANDAT_CONTACT_EMAIL`), lié dans Réglages → Informations légales → Aide et contact. | Créer la boîte e-mail de contact, relire la page, renseigner l'URL dans ASC. |
| 1.13 | URL marketing | ❌ (facultatif) | user | 2 h | — | Même page vitrine. |
| 1.14 | **URL de politique de confidentialité** | ⚠️ | user + lawyer | voir §2 | ✅ Brouillon FR/EN servi par l'API (`/legal/privacy`), lié dans Réglages, à l'inscription et sur l'écran d'accueil (`EXPO_PUBLIC_LEGAL_BASE_URL`, par défaut `https://mandat.cyber-dodo.fr`). Bandeau « projet à faire valider par un juriste ». | Faire valider le texte, retirer le bandeau, renseigner l'URL dans ASC. |
| 1.15 | CGU / EULA | ⚠️ | user + lawyer | voir §2 | ✅ Brouillon de CGU FR/EN (`/legal/terms`) : âge minimum, conduite, modération, objets virtuels sans valeur ni revente, retrait sur demande. Lié dans l'app. | Validation par l'avocat ; incrémenter `MANDAT_TERMS_VERSION` à chaque changement (les joueurs réacceptent). |
| 1.16 | Coordonnées de revue (App Review contact) | ❌ | user | 5 min | — | Nom, téléphone et e-mail joignables pendant la revue. |
| 1.17 | **Compte de démo** (2.1 : connexion obligatoire, donc compte de test exigé) [1] | ❌ | dev + user | 1 h | Inscription email/mot de passe fonctionnelle. | Créer `review@…` en production, avec une collection fournie (quelques boosters déjà ouverts, booster gratuit disponible, quiz et duel jouables). Le noter dans les « Notes pour la revue », avec une explication courte du jeu, des cotes et des boosters gratuits sans achat. |
| 1.18 | **Sign in with Apple (4.8)** | ✅ | — | — | Apple est proposé (`usesAppleSignIn: true`, `SocialSignIn.tsx`). Google est masqué tant qu'aucun client id n'est configuré. 4.8 n'impose une alternative que si un login tiers existe [1] : c'est déjà couvert. | Rien. Si Google est activé plus tard, Apple reste présenté au même niveau. |
| 1.19 | **Suppression de compte dans l'app (5.1.1(v))** | ✅ (code) / ⚠️ (clé) | user | 30 min | ✅ `DELETE /api/v1/me` et bouton Réglages. ✅ Révocation Sign in with Apple : l'app envoie l'`authorizationCode`, l'API l'échange contre un refresh token Apple stocké chiffré (AES-GCM) et appelle l'endpoint de révocation d'Apple avant la suppression. Sans clé configurée, l'étape est sautée et journalisée. | **User** : créer une clé « Sign in with Apple » (.p8) et renseigner `MANDAT_APPLE_TEAM_ID`, `MANDAT_APPLE_KEY_ID`, `MANDAT_APPLE_PRIVATE_KEY` (+ `MANDAT_DATA_KEY` recommandé). Option : notifications serveur à serveur Apple. |
| 1.20 | **Cotes des loot boxes (3.1.1)** | ✅ | — | — | `GET /api/v1/packs/{id}/odds` et `OddsSheet.tsx`, finitions comprises. 3.1.1 ne vise que les objets aléatoires **achetés** [1] : aujourd'hui tout est gratuit. | Garder les cotes accessibles avant l'ouverture. À rebrancher sur le paywall le jour où la Réserve Premium existe (BUSINESS §4.1). |
| 1.21 | **Figures réelles, contenu politique (1.1.1, 1.1.7, 5.2.1)** ⚖️ | ❌ | user + lawyer | 2 j + juridique | 500 figures, **165 vivantes**, **23 sensibles**. Hitler et Staline sont mythiques, Goebbels épique, Eichmann et al-Baghdadi rares, tous avec une vraie photo et des finitions holo/or. Poutine mythique, Zelensky et Netanyahou épiques (conflits en cours, 1.1.7 « capitalize … on … violent conflicts ») [1]. Décision utilisateur du 19/10 : les sensibles s'affichent comme les autres (DEVIATIONS). La revue TCG (P0-2, P0-3) recommandait l'inverse. | **Décision à prendre avant la soumission**, au minimum : (a) retirer les exécutants sans fonction d'État (Eichmann, al-Baghdadi, Guzmán) ; (b) finition forcée `standard` pour les sensibles ; (c) photos de sensibles **sans symbole nazi visible** (§86a StGB en Allemagne : à vérifier par l'avocat, ou ne pas distribuer en Allemagne en v1) ; (d) dirigeants d'un pays en guerre active plafonnés à rare, capacité au nom neutre ; (e) procédure de retrait sur demande dans les CGU ; (f) dans les notes de revue : « jeu éducatif, ton factuel, aucune satire ». **Exclure la Chine continentale** des pays de distribution (licence de jeu obligatoire et contenu politique). |
| 1.22 | **Contenu généré par les utilisateurs (1.2)** : filtre, signalement, blocage, contact | ✅ (code) | user | 30 min | ✅ Filtre de pseudos. ✅ Signalement. ✅ Blocage (profil du joueur, liste et déblocage dans Réglages) : retire l'amitié ; profil, comparaison, demandes d'ami, relances et séries entre amis deviennent impossibles dans les deux sens. ✅ API admin (rôle `admin`) : lister les signalements, les marquer traités, bannir / débannir, renommer de force. ✅ Alerte à chaque signalement : ligne de log + webhook facultatif `MANDAT_MODERATION_WEBHOOK`. ✅ Contact publié (`/support`). | Donner le rôle admin à ton compte (`update users set role = 'admin' where friend_code = '…'`), configurer le webhook, définir un délai de traitement. |
| 1.23 | Fonctionnalité minimale (4.2) | ✅ | — | — | Boosters, collection, craft, missions, passe, quiz, duel IA, amis, notifications. | — |
| 1.24 | **Menus de dev cachés en production** | ✅ | — | — | `app/dev/cards.tsx` redirige si `!__DEV__` ; l'entrée Réglages n'apparaît que sous `__DEV__`. | Vérifier sur le build `production` (pas `development`) avant l'envoi. |
| 1.25 | Contenu provisoire | ✅ | — | — | Plus de « Bientôt disponible » : liens légaux réels dans Réglages, piste Premium du passe masquée, mention « Bientôt aussi en Sceaux » retirée. | — |
| 1.26 | Risque de plantage au lancement | ⚠️ | dev | 0,5 j | `npm run check:worklets` existe (correctifs passés, `c56a802`) ; pas de crash reporting en production. | Tester un build `production` installé à neuf (sans session), en mode avion, sur iPhone ancien et récent. Ajouter Sentry (§3.3). |
| 1.27 | **Statut de « trader » DSA** (distribution UE) | ❌ | user (+ lawyer) | 1 h | Sans déclaration, l'app n'est pas distribuée dans l'UE (Apple a retiré les apps non conformes le 18/02/2025) [7]. | Dans ASC → Business : déclarer le statut. Avec une monétisation prévue, c'est « trader » : **adresse, téléphone et e-mail affichés publiquement** sur la fiche UE (une boîte postale ou une domiciliation est possible). Si tu publies en nom propre, envisage une micro-entreprise ou une SASU (D-U-N-S). |
| 1.28 | Prix et disponibilité | ❌ | user | 15 min | — | Gratuit, sans achat intégré en v1. Pays : tous **sauf Chine continentale** (voir 1.21). BE/NL possibles tant qu'aucun objet aléatoire n'est payant. |
| 1.29 | Copyright, version | ⚠️ | user | 5 min | ✅ `version: '1.0.0'` dans `app.config.ts`. | Champ Copyright « 2026 Cyber-Dodo » (ou ton nom) dans ASC. |

---

## 2. Juridique (France / UE) ⚖️

### 2.1 Inventaire des données (base de la politique de confidentialité)

| Donnée | Où | Base légale probable | Conservation proposée |
|---|---|---|---|
| E-mail, hash du mot de passe | `users` (V2, V10) | Exécution du contrat (CGU) | Jusqu'à la suppression du compte |
| Identifiant Apple (`sub`), e-mail relais Apple | `users` | Contrat | Idem ; révocation Apple à la suppression (1.19) |
| Pseudo, code ami, avatar, bannière, titre, vitrine | `users`, profil | Contrat | Idem |
| Collection, progression, missions, quiz, duels, portefeuille | tables de jeu | Contrat | Idem |
| Amis, signalements | `friendships`, `reports` | Contrat / intérêt légitime (modération) | Signalements : 12 mois après traitement, à préciser |
| Jeton push Expo, préférences | `push_devices` (V100) | Consentement (prompt iOS) | Jusqu'à la désinscription ou la suppression du compte |
| Langue, fuseau horaire, réglages | `users` | Contrat | Idem |
| Refresh tokens, libellé d'appareil | `refresh_tokens` | Contrat / sécurité | 30 jours (TTL) |
| IP dans les logs (rate limit, accès Traefik) | logs Dokploy | Intérêt légitime (sécurité) | Rotation à définir (≤ 12 mois, recommandé 1 à 3 mois) |

Sous-traitants et transferts : **hébergeur du serveur Dokploy** (à nommer, région UE ?) ; **Expo (650 Industries, États-Unis)** pour le service de push, ce qui est un transfert hors UE (vérifier l'adhésion au DPF ou signer les clauses contractuelles types, DPA Expo) ; **Apple** (APNs, Sign in with Apple, distribution) ; Let's Encrypt (certificat, pas de données personnelles). **Wikimedia** : les portraits sont **embarqués** dans l'app (`mobile/assets/portraits`), aucun appel réseau vers Wikimedia à l'usage, sauf si l'utilisateur ouvre un lien de licence depuis les crédits.

### 2.2 Checklist juridique

| # | Point | État | Qui | Effort | Constat / à faire |
|---|---|---|---|---|---|
| 2.1 | **Politique de confidentialité** (RGPD art. 13) | ⚠️ | user + lawyer | relecture | ✅ Brouillon FR/EN (`/legal/privacy`) tiré du tableau 2.1 : responsable (`MANDAT_OPERATOR_NAME`, `MANDAT_OPERATOR_ADDRESS`), finalités, bases légales, durées, sous-traitants (hébergeur `MANDAT_HOSTING_PROVIDER`, Expo aux États-Unis sous clauses contractuelles types, Apple), droits, CNIL, mineurs. À faire valider. |
| 2.2 | **CGU** | ⚠️ | user + lawyer | relecture | ✅ Brouillon FR/EN (`/legal/terms`). Reste : médiation de la consommation, droit applicable, validation par l'avocat. |
| 2.3 | **Mentions légales** (LCEN art. 6) | ⚠️ | user | 30 min | ✅ Page `/legal/notice` alimentée par la configuration (éditeur, adresse, contact, hébergeur). Renseigner les variables `MANDAT_OPERATOR_*` et `MANDAT_HOSTING_PROVIDER`. |
| 2.4 | Acceptation des CGU à l'inscription | ✅ | — | — | Case obligatoire à l'inscription (CGU + confidentialité + âge, avec liens) ; mention « En continuant avec Apple ou Google… » sur l'accueil. Le serveur stocke `terms_version`, `terms_accepted_at`, `age_confirmed_at` (migration V121) et refuse une inscription sans acceptation. Quand `MANDAT_TERMS_VERSION` change, l'app demande une nouvelle acceptation (`POST /api/v1/me/terms`). |
| 2.5 | **Âge et mineurs** | ⚠️ | user + lawyer | consultation | ✅ Case « j'ai au moins N ans » (N = `MANDAT_MINIMUM_AGE`, 15 par défaut, affiché par l'app via `GET /api/v1/legal`). Âge (13 ou 15) et texte pour les mineurs à valider par l'avocat. |
| 2.6 | ATT, cookies | ✅ | — | — | Pas d'IDFA, pas de SDK publicitaire, pas d'analytics tiers : **pas de prompt ATT**, pas de bandeau. À revoir si un outil d'analyse est ajouté (CNIL : exemption seulement pour une mesure d'audience strictement nécessaire). |
| 2.7 | Droits RGPD : export et suppression | ⚠️ | dev | 1 j | ✅ Suppression dans l'app. ❌ Pas d'export (accès art. 15, portabilité art. 20). Acceptable au lancement via une demande par e-mail traitée sous un mois, avec un script SQL d'export. Mieux : `GET /api/v1/me/export` (JSON). |
| 2.8 | **Droit à l'image des personnes vivantes** ⚖️ | ❌ | lawyer | consultation | 165 figures vivantes, vraies photos, cartes « collectionnables ». La licence CC du photographe **ne vaut pas** consentement de la personne (BUSINESS §4.4). C'est le **risque juridique n° 1**, déjà identifié. Même sans paiement, une app publique diffusée largement est une exploitation : l'avis est à obtenir **avant la soumission publique**, pas seulement avant la monétisation (revue TCG, P0-3). |
| 2.9 | **Licences des photos Wikimedia** | ⚠️ | dev + lawyer | 0,5 j | ✅ 499/500 portraits ont auteur, licence et source (`data/portraits.manifest.json`), visibles dans Réglages → Crédits photo et sur la fiche carte. Répartition : 310 domaine public, 92 CC BY, 72 CC BY-SA, **25 « autres »** (OGL 3, GODL-India, « Attribution », OGL v1.0…), 1 manquant. ⚠️ CC BY-SA : les photos sont recadrées et converties en WebP, donc ce sont des adaptations ; il faut les indiquer comme modifiées et les placer sous la même licence (une ligne dans l'écran crédits suffit). ⚠️ Revoir les 25 licences « autres », en particulier GODL-India (pas d'usage laissant croire à une approbation) et les « Attribution » sans version. |
| 2.10 | Sons | ✅ | — | — | Kenney CC0, recettes documentées (`mobile/assets/sounds/LICENSES.md`). Créditer Kenney dans l'écran crédits (courtoisie). |
| 2.11 | **Polices** (Bricolage Grotesque, Figtree, Nunito : SIL OFL 1.1) | ⚠️ | dev | 2 h | L'OFL demande de joindre l'avis de copyright et la licence quand la police est redistribuée (elle l'est, dans le binaire). Aucun écran ne le fait aujourd'hui. Ajouter un écran « Licences » : polices OFL, Ionicons (MIT), `country-flag-icons` (MIT), bibliothèques open source (liste générée par un script `license-checker`). |
| 2.12 | Illustrations générées (art pack, avatars, bannières) | ⚠️ | user | 1 h | `docs/ART_PROMPTS.md` : vérifier que les conditions de l'outil de génération permettent un usage commercial, et le noter dans `DEVIATIONS.md`. |
| 2.13 | Loot boxes (BE, NL, France) | ✅ (v1) | — | — | Aucun achat : les boosters gratuits ne sont pas des jeux d'argent (pas de sacrifice financier). Hors JONUM (cartes non cessibles). À rouvrir avec la Réserve Premium (D5). |
| 2.14 | PEGI / IARC | ✅ (iOS) | — | — | Inutile sur iOS (classification Apple, 1.6). Nécessaire pour Google Play (questionnaire IARC) : déclarer les objets aléatoires (gratuits). |
| 2.15 | Registre des traitements (RGPD art. 30) | ❌ | user | 2 h | Obligatoire en pratique (traitement non occasionnel) : un tableur tiré de 2.1 suffit. |
| 2.16 | Notification de violation de données | ❌ | user | 1 h | Procédure écrite de 72 h vers la CNIL (une page). |

---

## 3. Préparation technique

### 3.1 Build et application

| # | Point | État | Qui | Effort | Constat / à faire |
|---|---|---|---|---|---|
| 3.1 | Profil `production` | ✅ | — | — | `eas.json` : `production` étend `base` (URL API de prod), `autoIncrement`, `appVersionSource: remote`, `submit.production.ios.ascAppId = 6824505283`. |
| 3.2 | Pas de dev client en production | ✅ | — | — | Le plugin `expo-dev-client` n'est déclaré que pour `APP_VARIANT=development`. Le module natif reste lié par l'autolinking, mais son lanceur n'est actif que dans les builds Debug ; le profil `production` produit un build Release. Vérifier à l'installation qu'aucun lanceur n'apparaît. |
| 3.3 | Numéro de version | ✅ | — | — | `1.0.0` dans `app.config.ts` (numéro de build géré à distance par EAS). |
| 3.4 | Bundle id | ✅ | — | — | `fr.cyberdodo.mandat` (dev : `.dev`). |
| 3.5 | Icône et splash définitifs | ⚠️ | user | 1 h | `assets/icon.png`, `splash-icon.png` présents. Vérifier qu'ils sont définitifs, 1024 × 1024 sans transparence pour l'icône. |
| 3.6 | Mode sombre / clair | ✅ | — | — | `userInterfaceStyle: automatic`, thème dans Réglages. |
| 3.7 | **Crash reporting** | ❌ | dev + user | 0,5 j | Aucun. Recommandé : `@sentry/react-native` (plugin Expo, région **UE** `de.sentry.io`, upload des sourcemaps via EAS), plus Sentry Java côté API. Mettre à jour les étiquettes (1.7) et la politique (2.1). User : créer le compte Sentry. |
| 3.8 | Analytics | ❌ (OK pour v1) | — | — | Aucune. Acceptable au lancement. Plus tard : événements first-party vers l'API (BUSINESS §6), sans consentement si strictement nécessaires. |
| 3.9 | Push (APNs) | ⚠️ | user | 30 min | `expo-notifications` en mode `production`, enregistrement après consentement. Vérifier que la clé APNs est bien gérée par EAS (`eas credentials`) et qu'un push arrive sur un build TestFlight. |
| 3.10 | Liens profonds / universels | ⚠️ (OK pour v1) | — | — | Schéma `mandat://` (`friend/[code]`). Pas d'universal links (`associatedDomains`, `apple-app-site-association`). Le partage de code ami fonctionne sans. Post-lancement. |
| 3.11 | Hors ligne | ⚠️ | dev | 0,5 j | `useIsOnline`, cache React Query persisté (MMKV), portraits embarqués, rappels locaux. À tester : lancement à froid hors ligne, perte du réseau pendant l'ouverture d'un booster (idempotence côté serveur ?). |
| 3.12 | Performance | ⚠️ | dev | 0,5 j | Binaire alourdi par ~21 Mo de portraits ; Skia, FlashList. Mesurer la taille du `.ipa` et le démarrage à froid sur un iPhone ancien (≥ iPhone 11). |
| 3.13 | Accessibilité | ⚠️ | dev | 1 j | `accessibilityLabel` sur les réglages, option « réduire les animations » qui suit le système. À vérifier : VoiceOver sur l'ouverture de booster et le duel, Dynamic Type, contrastes. (Les « Accessibility Nutrition Labels » de la fiche sont facultatifs.) |
| 3.14 | Localisation FR/EN | ✅ | — | — | `npm run check:i18n` : « en match fr ». Textes du permis de mouvement (`motionPermission`) en anglais seulement : localiser via `ios.infoPlist` / `locales`. |

### 3.2 Serveur (Dokploy)

| # | Point | État | Qui | Effort | Constat / à faire |
|---|---|---|---|---|---|
| 3.15 | **Sauvegardes Postgres** | ❌ | user (+ dev) | 2 h | `docker-compose.prod.yml` : un seul conteneur `postgres:18-alpine` sur un volume local, **aucune sauvegarde** dans le dépôt. Activer les sauvegardes planifiées Dokploy vers un stockage S3 hors serveur (quotidiennes, rétention 14 à 30 jours, chiffrées), puis **tester une restauration**. |
| 3.16 | **Supervision, uptime, alertes** | ❌ | user | 1 h | `/actuator/health` est public. Ajouter une sonde externe (UptimeRobot, Better Stack, Uptime Kuma) avec alerte e-mail/téléphone, et l'alerte disque du serveur. |
| 3.17 | Page de statut | ❌ (facultatif) | user | 30 min | Une page publique de la sonde suffit. |
| 3.18 | Limites de débit | ⚠️ | dev | 0,5 j | ✅ register (5/h/IP), login (20/min/IP, 5/5 min/compte), refresh, social, signalements, ouverture de packs. Les limites sont **en mémoire** (instance unique : acceptable, mais remises à zéro à chaque redéploiement). Manquent : changement de pseudo, demandes d'ami, création de quiz/duel. |
| 3.19 | Secrets | ⚠️ | user | 30 min | Variables d'environnement Dokploy. Nouvelles : `MANDAT_DATA_KEY`, `MANDAT_APPLE_*`, `MANDAT_SMTP_*`, `MANDAT_MODERATION_WEBHOOK` (voir `.env.example`). Vérifier `POSTGRES_PASSWORD` fort, `.env` hors git, rotation documentée. |
| 3.20 | Documentation d'API en production | ✅ | — | — | Swagger UI et `/v3/api-docs` sont toujours désactivés avec le profil `prod`, quelle que soit la variable d'environnement. |
| 3.21 | Actuator | ✅ | — | — | Seul `health` est exposé (sans détails) ; le reste des endpoints de gestion n'est plus servi en HTTP. |
| 3.22 | Migrations | ✅ / ⚠️ | dev | — | Flyway + `ddl-auto: validate`. ⚠️ Le seeder fait un upsert par `id` de carte (`s1-001`…), et l'id suit le **numéro, donc le rang de notoriété**. Les derniers changements de catalogue (`1880cf9`, figures obligatoires) ont pu **réattribuer des ids à d'autres personnes** dans les collections existantes. **Avant l'ouverture publique : vider la base de prod** (comptes TestFlight compris), puis **geler les ids** (ne plus jamais renuméroter une carte publiée ; ajouter une vérification au build). |
| 3.23 | CORS, HTTPS | ✅ | — | — | CORS vide par défaut (app native), Traefik + Let's Encrypt, redirection HTTP vers HTTPS. Ajouter HSTS (middleware Traefik). |
| 3.24 | Logs | ⚠️ | user | 30 min | JSON ECS sur stdout, sans stacktrace dans les réponses. Définir la rétention des logs Docker (rotation `max-size`/`max-file`) et la durée de conservation des IP (2.1). |
| 3.25 | Instance unique | ⚠️ (OK pour v1) | — | — | Une API, une base, un serveur. Verrou de planification présent (`SchedulerLock`). Suffisant pour quelques milliers de joueurs ; noter le plan de montée en charge. |
| 3.26 | **Réinitialisation du mot de passe** | ✅ (code) / ⚠️ (e-mail) | user | 1 h | ✅ « Mot de passe oublié » dans l'app ; jeton signé aléatoire à usage unique, 30 min, stocké haché ; page `/reset-password` ; limites de débit ; toutes les sessions sont révoquées après le changement. Sans `MANDAT_SMTP_HOST`, l'e-mail n'est pas envoyé (une ligne de log le signale). **User** : fournisseur d'e-mail transactionnel UE (Brevo, Scaleway TEM, Mailjet), `MANDAT_SMTP_*`, SPF/DKIM/DMARC. **Suite** : vérification d'e-mail à l'inscription (à faire). |
| 3.27 | Correctif de sécurité du rattachement de compte | ✅ | — | — | Correctif de sécurité du rattachement de compte : fait (tests d'intégration écrits, à exécuter). La vérification de l'adresse e-mail à l'inscription reste à faire (voir 3.26). |
| 3.28 | Outils de modération et d'admin | ✅ | — | — | Voir 1.22 : API `/api/v1/admin` réservée au rôle admin (signalements, bannissement, renommage). Pas d'interface graphique : appels HTTP authentifiés. |
| 3.29 | Tests de bout en bout sur la prod | ⚠️ | dev | — | `src/lib/api/__tests__/production.e2e.test.ts` existe. Le lancer juste avant la soumission, avec le compte de démo. |

---

## 4. Complétude produit (brief et demandes)

D'après l'historique git (73 commits) et les docs :

| Domaine | État | Commentaire |
|---|---|---|
| Pipeline de cartes (Wikidata, notoriété, quotas, plafonds) | ✅ | 500 cartes, bios FR/EN, stats, capacités, frises Wikidata, figures obligatoires (`1880cf9`). |
| Auth (email, Apple), compte, réglages | ✅ / ⚠️ | Google non configuré (masqué, acceptable). Mot de passe oublié fait (3.26) ; vérification d'e-mail à faire. |
| Boosters, cotes, pity, premier booster, finitions | ✅ | Revue TCG P0-7 traitée (`a9d1377`). |
| Collection, recyclage, craft, économie | ✅ | P0-1 (plafonds quotidiens) et P0-4 (rééquilibrage) traités (`299b060`). |
| Progression (XP, série, missions, succès, passe) | ✅ / ⚠️ | Piste Premium masquée (1.25). D7 (saisons de 14 semaines) reste à décider. |
| Profil et social (amis, vitrine, signalement, blocage) | ✅ | Blocage et outils de modération (1.22). |
| Quiz, duel contre l'IA | ✅ (v1) | Le duel v1 est jugé « minable » (TCG_REVIEW §4.1). **Duel v2 « Hémicycle » + PvP : conçu (`docs/DUEL_V2.md`), pas implémenté, ~31 j** (16 j moteur/IA/PvP + 15 j cabinets/plateau/appariement). Post-lancement. P0-5 (une mythique perd plus qu'une commune) : le validateur de capacités est corrigé, à confirmer par une simulation avant le lancement. |
| Notifications push | ✅ | Catégories, opt-in, repli en notifications locales. |
| FTUE, direction artistique, sons | ✅ | `f506e60`, `38d5de9`, `bdd878d`. |
| Drapeaux | ✅ | P0-6 traité (`da46b16`). |
| Accueil sans action (P0-8) | ⚠️ | À vérifier sur le dernier build. |
| Figures sensibles et vivantes (P0-2, P0-3) | ❌ | Décision utilisateur contraire à la revue. À trancher (1.21). |
| Histoires des cartes (`story`, `highlights`, `legacy`) | ⚠️ en cours | ~500 fichiers `data/content/*.json` modifiés, non commités. Champs facultatifs : ne bloquent pas. |
| Calibrage du style | ⚠️ en cours | Ne bloque pas. |
| Monétisation (Premium, Sceaux, RevenueCat) | ❌ (OK pour v1) | Pas d'IAP, donc pas de paywall, de restauration ni de 3.1.2 à gérer. Lancer en **100 % gratuit** est le choix le plus simple pour passer la revue. |
| Android | ❌ | Jamais construit ni testé. À prévoir : build EAS Android, clé FCM V1, fiche Play, IARC, Data safety, test sur appareil, retour prédictif désactivé (déjà configuré). |

---

## 5. Plan de lancement

### 5.1 Obligatoire avant la soumission (bloquant)

| # | Tâche | Qui | Effort |
|---|---|---|---|
| B1 | Décision sur les figures sensibles et vivantes (1.21) + avis d'avocat (droit à l'image, symboles nazis, JONUM, CGU) | user + lawyer | 1 à 3 semaines (calendrier de l'avocat) |
| B2 | Rédiger la politique de confidentialité, les CGU et les mentions légales ; les héberger (FR + EN) | dev (brouillon) → user + lawyer | 1 j de brouillon + relecture |
| B3 | Page de support + e-mail de contact | user | 2 h |
| B4 | ✅ Liens légaux et contact dans l'app (Réglages, inscription), acceptation des CGU stockée, case d'âge | — | fait |
| B5 | ✅ (code) Révocation du jeton Sign in with Apple à la suppression du compte ; reste la clé `.p8` | user | 30 min |
| B6 | ✅ Blocage d'un joueur + traitement minimal des signalements (alerte + bannissement / renommage) | — | fait |
| B7 | ✅ `ios.privacyManifests` | — | fait |
| B8 | ✅ Supprimer les textes « Bientôt » et masquer la piste Premium | — | fait |
| B9 | ✅ Version 1.0.0, `expo-dev-client` limité au profil dev ; ⚠️ reste à tester un build `production` installé à neuf | dev + user | 2 h |
| B10 | Remise à zéro de la base de prod + gel des ids de cartes (vérification au build) | dev + user | 0,5 j |
| B11 | Sauvegardes Postgres hors serveur + test de restauration | user | 2 h |
| B12 | ✅ Documentation d'API désactivée en prod, actuator limité à `health` | — | fait |
| B13 | Compte de démo en prod + notes de revue | dev + user | 1 h |
| B14 | Fiche ASC : nom, sous-titre, mots-clés, catégorie, langue, âge, étiquettes de confidentialité, prix, pays (sans la Chine), copyright, contact de revue | user | 0,5 j |
| B15 | Statut de trader DSA (et choix de la structure juridique) | user | 1 h (+ délai administratif si création de société) |
| B16 | Captures iPhone 6,9" FR + EN avec des figures historiques du domaine public | user (dev peut produire les états d'écran) | 1 j |

### 5.2 À faire avant la sortie publique (fortement recommandé)

| # | Tâche | Qui | Effort |
|---|---|---|---|
| S1 | ✅ Mot de passe oublié ; reste la vérification d'e-mail (dev, 0,5 j) et le fournisseur d'e-mail UE (user) | dev + user | 1 j |
| S2 | ✅ Correctif de sécurité du rattachement de compte (3.27) | — | fait |
| S3 | Sentry (app + API, région UE) | dev + user | 0,5 j |
| S4 | Sonde d'uptime + alertes, rotation des logs, HSTS | user | 1 h |
| S5 | Écran « Licences » (polices OFL, MIT, open source, Kenney) ; mention « adapté » pour les photos CC BY-SA ; revue des 25 licences « autres » | dev | 0,5 j |
| S6 | Export des données (`GET /me/export`) ou procédure manuelle documentée | dev | 1 j |
| S7 | Limites de débit sur pseudo, amis, quiz et duels | dev | 0,5 j |
| S8 | Tests hors ligne, VoiceOver, appareil ancien, taille du binaire | dev | 1 j |
| S9 | Registre des traitements, procédure de violation, DPA Expo | user | 0,5 j |
| S10 | Simulation de duel : confirmer qu'une mythique n'est plus une mauvaise carte (P0-5) ; vérifier l'accueil sans action (P0-8) | dev | 0,5 j |
| S11 | Localiser le texte de permission « mouvement » | dev | 30 min |

### 5.3 Après le lancement

Duel v2 « Hémicycle » + PvP (~31 j) · histoires des cartes · monétisation (RevenueCat, Premium, Sceaux, paywall avec cotes, D5 BE/NL) · universal links · aperçu vidéo App Store · analytics first-party · Google sign-in · **Android** (build, FCM, fiche Play, IARC, Data safety) · albums et méta de collection (TCG_REVIEW §3, §8) · page de statut.

### 5.4 Ce que l'agent dev peut faire tout de suite

Faits : B4, B5 (code), B6, B7, B8, B9 (code), B12, S1 (mot de passe oublié), S2, brouillons B2.

À valider : la suite de tests de l'API (Testcontainers) n'a pas encore tourné sur ce lot ; l'export OpenAPI
(`./gradlew exportOpenApi`) et `npm run api:gen` sont à relancer pour confirmer le contrat, mis à jour à la main.

Restent pour l'agent :
1. B10 : gel des ids au build ; script de remise à zéro (que tu lances).
2. B13 : script de création du compte de démo ; B16 : préparation d'états d'écran pour les captures.
3. Vérification d'e-mail à l'inscription (suite de S1), S3, S5, S6, S7, S10, S11.

### 5.5 Ce que toi seul peux faire

- Prendre la décision B1 et consulter l'avocat (droit à l'image, symboles, CGU, JONUM, mineurs, médiation).
- Choisir la structure juridique, déclarer le statut DSA, fournir les mentions légales (identité, adresse, hébergeur).
- Héberger les pages légales et de support, créer l'adresse e-mail de support.
- App Store Connect : nom, métadonnées, questionnaire d'âge, étiquettes de confidentialité, pays, contact de revue, captures.
- Portail Apple Developer : clé Sign in with Apple `.p8` (`MANDAT_APPLE_TEAM_ID`, `MANDAT_APPLE_KEY_ID`, `MANDAT_APPLE_PRIVATE_KEY`) ; vérifier la clé APNs dans EAS.
- Dokploy : sauvegardes S3, secrets (`MANDAT_DATA_KEY`, `MANDAT_SMTP_*`, `MANDAT_MODERATION_WEBHOOK`, `MANDAT_OPERATOR_*`, `MANDAT_HOSTING_PROVIDER`, `MANDAT_CONTACT_EMAIL`), sonde d'uptime ; comptes Sentry et e-mail transactionnel (DNS SPF/DKIM/DMARC).
- Donner le rôle `admin` à ton compte pour la modération.
- Valider la remise à zéro de la base de prod.

### 5.6 Calendrier proposé (à partir du lundi 19/10/2026)

| Semaine | Dev | User / avocat |
|---|---|---|
| **S1 (19–25/10)** | B4, B5, B6, B7, B8, B9, B12 ; brouillons juridiques (B2) | Décision B1, prise de rendez-vous avec l'avocat, structure juridique et DSA (B15), page de support (B3), sauvegardes (B11) |
| **S2 (26/10–1/11)** | S1, S2, S3, S5, S10 ; B10 prêt | Relecture des textes par l'avocat, fiche ASC (B14), captures (B16) |
| **S3 (2–8/11)** | Corrections du contenu selon l'avis (B1), build `production`, tests S8, compte de démo (B13), remise à zéro de la base | Publication des textes, étiquettes de confidentialité, **soumission vers le 6–10/11** |
| **S4 (9–15/11)** | Corrections après revue Apple (compter 1 ou 2 allers-retours de 24 à 48 h) | Réponses à la revue |
| **S5 (16–30/11)** | S6, S7, S11 ; préparation d'Android | **Sortie publique** (publication manuelle après approbation) |

Hypothèses : un développeur à temps plein (agent + toi), l'avocat disponible sous 2 semaines, aucune création de
société longue. Si l'avis juridique impose de retirer ou de remplacer des figures, il faut ajouter 2 à 4 jours de
contenu (pipeline, bios, capacités, portraits, crédits) et décaler d'autant.

---

## Sources

1. Apple, *App Store Review Guidelines* (1.1.1, 1.1.7, 1.2, 2.1, 2.3.9, 3.1.1, 4.8, 5.1.1(i), 5.1.1(v), 5.2.1) — https://developer.apple.com/app-store/review/guidelines/
2. Apple, *Offering account deletion in your app* (« Apps that support Sign in with Apple should use the Sign in with Apple REST API to revoke user tokens ») — https://developer.apple.com/support/offering-account-deletion-in-your-app/ ; *Revoke tokens* — https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
3. Expo, *Privacy manifests* (`ios.privacyManifests`, limites des manifestes CocoaPods statiques) — https://docs.expo.dev/guides/apple-privacy/
4. Apple, *Complying with encryption export regulations* — https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations ; forum Apple — https://developer.apple.com/forums/thread/121183
5. Tailles de captures (6,9" obligatoire, 6,5" en repli) — https://studio.adalo.com/blog/app-store-screenshot-sizes-2026 ; https://appscreenshotstudio.com/blog/iphone-app-store-screenshot-sizes-2026-required-vs-optional ; à confirmer sur la référence Apple : https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications
6. Nouveau questionnaire d'âge (13+/16+/18+, échéance au 31/01/2026, loot boxes et jeu d'argent simulé) — https://trysonar.app/blog/app-store-age-rating ; https://www.businesstoday.in/amp/technology/news/story/apple-overhauls-app-store-age-ratings-adds-new-13-16-and-18-categories-486587-2025-07-28 ; référence Apple : https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions
7. Statut de trader DSA (retrait des apps non conformes le 18/02/2025, coordonnées affichées) — https://techcrunch.com/?p=2967719 ; https://sdtimes.com/mobile/apple-adds-new-requirements-for-apps-distributed-through-the-app-store-in-the-eu/ ; référence Apple : https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
8. Documents internes : `docs/BUSINESS.md` §0 et §4, `docs/TCG_REVIEW.md` (liste P0), `docs/DUEL_V2.md` §9, `docs/DEVIATIONS.md`.
