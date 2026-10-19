package com.mandat.api.legal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Locale;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;

/**
 * Public legal pages (privacy policy, terms, legal notice, support) referenced by the app and by
 * App Store Connect, plus the JSON summary the app reads at sign-up. The texts are drafts that
 * must be validated by a lawyer before the public launch.
 */
@RestController
@Tag(name = "Legal")
public class LegalController {

    private final LegalProperties legal;

    LegalController(LegalProperties legal) {
        this.legal = legal;
    }

    public record LegalInfo(String termsVersion, int minimumAge, String contactEmail) {}

    @GetMapping("/api/v1/legal")
    @Operation(operationId = "getLegalInfo", summary = "Current terms version, minimum age and contact (public)")
    public LegalInfo info() {
        return new LegalInfo(legal.termsVersion(), legal.minimumAge(), legal.contactEmail());
    }

    @GetMapping(value = "/legal/privacy", produces = MediaType.TEXT_HTML_VALUE)
    public String privacy(@RequestParam(required = false) String lang,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        return english(lang, acceptLanguage) ? page("Privacy policy", privacyEn()) : page("Politique de confidentialité", privacyFr());
    }

    @GetMapping(value = "/legal/terms", produces = MediaType.TEXT_HTML_VALUE)
    public String terms(@RequestParam(required = false) String lang,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        return english(lang, acceptLanguage) ? page("Terms of use", termsEn()) : page("Conditions générales d'utilisation", termsFr());
    }

    @GetMapping(value = "/legal/notice", produces = MediaType.TEXT_HTML_VALUE)
    public String notice(@RequestParam(required = false) String lang,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        return english(lang, acceptLanguage) ? page("Legal notice", noticeEn()) : page("Mentions légales", noticeFr());
    }

    @GetMapping(value = "/support", produces = MediaType.TEXT_HTML_VALUE)
    public String support(@RequestParam(required = false) String lang,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        return english(lang, acceptLanguage) ? page("Support", supportEn()) : page("Assistance", supportFr());
    }

    private static boolean english(String lang, String acceptLanguage) {
        String chosen = lang != null ? lang : acceptLanguage;
        return chosen != null && chosen.toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String e(String value) {
        return HtmlUtils.htmlEscape(value);
    }

    private String page(String title, String body) {
        return """
                <!doctype html><html><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>%s · MANDAT</title>
                <style>body{font-family:-apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;
                line-height:1.55;color:#12172a;background:#f3eee3}h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:1.6em}
                .draft{background:#fff3cd;border:1px solid #e0b100;padding:8px 12px;border-radius:8px}</style></head>
                <body><h1>%s</h1><p class="draft">Version %s — projet à faire valider par un juriste / draft pending legal review.</p>
                %s</body></html>
                """.formatted(e(title), e(title), e(legal.termsVersion()), body);
    }

    private String privacyFr() {
        return """
                <h2>Responsable du traitement</h2><p>%s, %s. Contact : <a href="mailto:%s">%s</a>.</p>
                <h2>Données traitées</h2><ul>
                <li>Compte : adresse e-mail (ou identifiant Apple/Google), pseudo, code ami, mot de passe chiffré (Argon2).</li>
                <li>Jeu : collection, progression, missions, quiz, duels, amis, signalements que vous envoyez.</li>
                <li>Appareil : langue, fuseau horaire, jeton de notification push si vous l'activez.</li></ul>
                <p>Aucune publicité, aucun pistage publicitaire, aucune revente de données.</p>
                <h2>Finalités et bases légales</h2><p>Fournir le jeu et votre compte (exécution du contrat), sécurité et
                lutte contre la fraude et les abus (intérêt légitime), notifications (consentement, révocable dans l'app).</p>
                <h2>Destinataires et sous-traitants</h2><p>Hébergement : %s. Notifications push : Expo (États-Unis,
                clauses contractuelles types). Connexion Apple/Google : selon votre choix.</p>
                <h2>Durée de conservation</h2><p>Tant que le compte existe. La suppression du compte dans l'app efface
                immédiatement toutes vos données de jeu. Journaux techniques : 30 jours.</p>
                <h2>Vos droits</h2><p>Accès, rectification, effacement (suppression du compte dans Réglages), portabilité,
                opposition et limitation : écrivez à <a href="mailto:%s">%s</a>. Vous pouvez saisir la CNIL (cnil.fr).</p>
                <h2>Âge minimum</h2><p>Le jeu est réservé aux personnes de %d ans et plus.</p>
                """.formatted(e(legal.operatorName()), e(legal.operatorAddress()), e(legal.contactEmail()),
                e(legal.contactEmail()), e(legal.host()), e(legal.contactEmail()), e(legal.contactEmail()),
                legal.minimumAge());
    }

    private String privacyEn() {
        return """
                <h2>Controller</h2><p>%s, %s. Contact: <a href="mailto:%s">%s</a>.</p>
                <h2>Data we process</h2><ul>
                <li>Account: email address (or Apple/Google identifier), nickname, friend code, hashed password (Argon2).</li>
                <li>Gameplay: collection, progression, missions, quizzes, duels, friends, reports you send.</li>
                <li>Device: language, time zone, push notification token if you enable notifications.</li></ul>
                <p>No advertising, no tracking, no sale of data.</p>
                <h2>Purposes and legal bases</h2><p>Providing the game and your account (contract), security and abuse
                prevention (legitimate interest), notifications (consent, revocable in the app).</p>
                <h2>Recipients and processors</h2><p>Hosting: %s. Push notifications: Expo (United States, standard
                contractual clauses). Apple/Google sign-in: as you choose.</p>
                <h2>Retention</h2><p>As long as the account exists. Deleting the account in the app erases all your game
                data immediately. Technical logs: 30 days.</p>
                <h2>Your rights</h2><p>Access, rectification, erasure (delete your account in Settings), portability,
                objection and restriction: write to <a href="mailto:%s">%s</a>. You may lodge a complaint with your
                data protection authority.</p>
                <h2>Minimum age</h2><p>The game is for people aged %d and over.</p>
                """.formatted(e(legal.operatorName()), e(legal.operatorAddress()), e(legal.contactEmail()),
                e(legal.contactEmail()), e(legal.host()), e(legal.contactEmail()), e(legal.contactEmail()),
                legal.minimumAge());
    }

    private String termsFr() {
        return """
                <h2>Objet</h2><p>MANDAT est un jeu de cartes à collectionner gratuit consacré aux figures politiques de
                l'histoire. Les cartes présentent des faits historiques à but éducatif et ne constituent ni un jugement
                ni une apologie.</p>
                <h2>Compte</h2><p>Vous devez avoir au moins %d ans. Vous êtes responsable de votre compte et de votre pseudo,
                qui doit rester correct : les pseudos injurieux, haineux ou extrémistes sont interdits et peuvent être
                modifiés ou entraîner la suspension du compte.</p>
                <h2>Contenus virtuels</h2><p>Les boosters, cartes, Influence et récompenses sont virtuels, sans valeur
                monétaire, non échangeables contre de l'argent. Les taux d'obtention sont affichés dans l'app.</p>
                <h2>Comportement</h2><p>Triche, exploitation de bugs, harcèlement et usurpation sont interdits. Vous pouvez
                signaler et bloquer un joueur depuis son profil.</p>
                <h2>Suspension et suppression</h2><p>Nous pouvons suspendre un compte qui enfreint ces règles. Vous pouvez
                supprimer votre compte à tout moment dans Réglages.</p>
                <h2>Contact</h2><p><a href="mailto:%s">%s</a></p>
                """.formatted(legal.minimumAge(), e(legal.contactEmail()), e(legal.contactEmail()));
    }

    private String termsEn() {
        return """
                <h2>Purpose</h2><p>MANDAT is a free collectible card game about political figures in history. Cards present
                historical facts for educational purposes and are neither a judgement nor an endorsement.</p>
                <h2>Account</h2><p>You must be at least %d. You are responsible for your account and nickname, which must
                stay decent: insulting, hateful or extremist nicknames are forbidden and may be changed or lead to a
                suspension.</p>
                <h2>Virtual items</h2><p>Boosters, cards, Influence and rewards are virtual, have no monetary value and cannot
                be exchanged for money. Drop rates are shown in the app.</p>
                <h2>Conduct</h2><p>Cheating, exploiting bugs, harassment and impersonation are forbidden. You can report and
                block a player from their profile.</p>
                <h2>Suspension and deletion</h2><p>We may suspend accounts that break these rules. You can delete your
                account at any time in Settings.</p>
                <h2>Contact</h2><p><a href="mailto:%s">%s</a></p>
                """.formatted(legal.minimumAge(), e(legal.contactEmail()), e(legal.contactEmail()));
    }

    private String noticeFr() {
        return """
                <p>Éditeur : %s, %s.</p><p>Contact : <a href="mailto:%s">%s</a>.</p><p>Hébergement : %s.</p>
                <p>Portraits : Wikimedia Commons, auteurs et licences listés dans l'app (Réglages → Crédits photos).
                Sons : packs Kenney (CC0). Polices : Bricolage Grotesque et Figtree (SIL Open Font License).</p>
                """.formatted(e(legal.operatorName()), e(legal.operatorAddress()), e(legal.contactEmail()),
                e(legal.contactEmail()), e(legal.host()));
    }

    private String noticeEn() {
        return """
                <p>Publisher: %s, %s.</p><p>Contact: <a href="mailto:%s">%s</a>.</p><p>Hosting: %s.</p>
                <p>Portraits: Wikimedia Commons, authors and licenses listed in the app (Settings → Photo credits).
                Sounds: Kenney packs (CC0). Fonts: Bricolage Grotesque and Figtree (SIL Open Font License).</p>
                """.formatted(e(legal.operatorName()), e(legal.operatorAddress()), e(legal.contactEmail()),
                e(legal.contactEmail()), e(legal.host()));
    }

    private String supportFr() {
        return """
                <p>Un souci avec votre compte, un bug ou une question ? Écrivez-nous à <a href="mailto:%s">%s</a> en
                indiquant votre code ami (Profil).</p>
                <p>Mot de passe oublié : utilisez « Mot de passe oublié » sur l'écran de connexion.</p>
                <p>Supprimer votre compte : Réglages → Compte → Supprimer mon compte.</p>
                """.formatted(e(legal.contactEmail()), e(legal.contactEmail()));
    }

    private String supportEn() {
        return """
                <p>Trouble with your account, a bug or a question? Write to <a href="mailto:%s">%s</a> with your friend
                code (Profile).</p>
                <p>Forgot your password: use "Forgot password" on the sign-in screen.</p>
                <p>Delete your account: Settings → Account → Delete my account.</p>
                """.formatted(e(legal.contactEmail()), e(legal.contactEmail()));
    }
}
