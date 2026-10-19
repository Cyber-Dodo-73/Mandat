package com.mandat.api.auth;

import io.swagger.v3.oas.annotations.Hidden;
import java.util.Locale;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The page the reset email links to: a form that posts the token from the URL and the new
 * password to {@code POST /api/v1/auth/password/reset}. Not cached, not framable, no referrer.
 */
@RestController
@Hidden
class ResetPasswordPageController {

    @GetMapping(value = "/reset-password", produces = MediaType.TEXT_HTML_VALUE)
    ResponseEntity<String> page(@RequestParam(required = false) String lang,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        String chosen = lang != null ? lang : acceptLanguage;
        boolean en = chosen != null && chosen.toLowerCase(Locale.ROOT).startsWith("en");
        String html = """
                <!doctype html><html lang="%s"><head><meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta name="referrer" content="no-referrer">
                <title>%s · MANDAT</title>
                <style>body{font-family:-apple-system,system-ui,sans-serif;max-width:420px;margin:0 auto;padding:32px 16px;
                color:#12172a;background:#f3eee3}input,button{font:inherit;width:100%%;box-sizing:border-box;padding:12px;
                margin:6px 0;border-radius:10px;border:1px solid #b9ae95}button{background:#12172a;color:#f3eee3;border:0}
                #msg{min-height:1.5em}</style></head>
                <body><h1>%s</h1>
                <form id="f"><label>%s<input id="p1" type="password" minlength="8" maxlength="128" required
                autocomplete="new-password"></label><label>%s<input id="p2" type="password" minlength="8" maxlength="128"
                required autocomplete="new-password"></label><button id="b" type="submit">%s</button></form>
                <p id="msg" role="status"></p>
                <script>
                const t = new URLSearchParams(location.search).get('token');
                const m = document.getElementById('msg');
                document.getElementById('f').addEventListener('submit', async (ev) => {
                  ev.preventDefault();
                  const p = document.getElementById('p1').value;
                  if (p !== document.getElementById('p2').value) { m.textContent = %s; return; }
                  document.getElementById('b').disabled = true;
                  try {
                    const r = await fetch('/api/v1/auth/password/reset', {method: 'POST',
                      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({token: t, password: p})});
                    if (r.status === 204) { document.getElementById('f').remove(); m.textContent = %s; return; }
                    m.textContent = r.status === 429 ? %s : %s;
                  } catch (e) { m.textContent = %s; }
                  document.getElementById('b').disabled = false;
                });
                </script></body></html>
                """.formatted(
                en ? "en" : "fr",
                en ? "New password" : "Nouveau mot de passe",
                en ? "Choose a new password" : "Choisis un nouveau mot de passe",
                en ? "New password (8 characters min.)" : "Nouveau mot de passe (8 caractères min.)",
                en ? "Confirm" : "Confirmation",
                en ? "Save" : "Enregistrer",
                js(en ? "The passwords do not match." : "Les mots de passe ne correspondent pas."),
                js(en ? "Done! Sign in to the app with your new password." : "C'est fait ! Connecte-toi dans l'app avec ton nouveau mot de passe."),
                js(en ? "Too many attempts, try again later." : "Trop de tentatives, réessaie plus tard."),
                js(en ? "This link is invalid or expired. Ask for a new one in the app." : "Ce lien est invalide ou expiré. Redemande-en un dans l'app."),
                js(en ? "Network error, try again." : "Erreur réseau, réessaie."));
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("X-Frame-Options", "DENY")
                .body(html);
    }

    private static String js(String text) {
        return "'" + text.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }
}
