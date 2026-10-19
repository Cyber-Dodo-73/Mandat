package com.mandat.api.push;

import java.util.Locale;

/**
 * A notification to send, rendered per device locale (FR by default, EN otherwise). {@code path}
 * is the in-app route opened on tap (the app adds its own URL scheme).
 */
public sealed interface PushNotification {

    PushCategory category();

    String path();

    Text text(String locale);

    record Text(String title, String body) {}

    static boolean english(String locale) {
        return locale != null && locale.toLowerCase(Locale.ROOT).startsWith("en");
    }

    record BoosterReady() implements PushNotification {
        public PushCategory category() {
            return PushCategory.BOOSTER_READY;
        }

        public String path() {
            return "/";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Your free booster is ready", "Five new figures are waiting to be revealed.")
                    : new Text("Ton booster gratuit est prêt", "Cinq nouvelles figures t'attendent. À toi de les révéler !");
        }
    }

    record StreakAtRisk(int streak) implements PushNotification {
        public PushCategory category() {
            return PushCategory.STREAK;
        }

        public String path() {
            return "/";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Keep your streak alive", "Your " + streak + "-day streak ends at midnight: open a booster or play a quiz.")
                    : new Text("Ta série est en danger", "Ta série de " + streak + " jour" + (streak > 1 ? "s" : "")
                            + " s'arrête à minuit : ouvre un booster ou fais un quiz.");
        }
    }

    record FriendRequest(String nickname) implements PushNotification {
        public PushCategory category() {
            return PushCategory.FRIENDS;
        }

        public String path() {
            return "/friends";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("New friend request", nickname + " wants to add you as a friend.")
                    : new Text("Nouvelle demande d'ami", nickname + " veut t'ajouter en ami.");
        }
    }

    record FriendAccepted(String nickname) implements PushNotification {
        public PushCategory category() {
            return PushCategory.FRIENDS;
        }

        public String path() {
            return "/friends";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Friend request accepted", nickname + " is now your friend. Compare your collections!")
                    : new Text("Demande acceptée", nickname + " est maintenant ton ami. Comparez vos collections !");
        }
    }

    record Nudge(String nickname) implements PushNotification {
        public PushCategory category() {
            return PushCategory.NUDGES;
        }

        public String path() {
            return "/";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text(nickname + " is nudging you!", "Your streak is waiting: open a booster or play a quiz today.")
                    : new Text(nickname + " te relance !", "Ta série t'attend : ouvre un booster ou fais un quiz aujourd'hui.");
        }
    }

    record FriendStreakInvite(String nickname) implements PushNotification {
        public PushCategory category() {
            return PushCategory.FRIENDS;
        }

        public String path() {
            return "/streak";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Friend streak invitation", nickname + " wants to start a streak with you.")
                    : new Text("Série entre amis", nickname + " te propose une série à deux. Relève le défi !");
        }
    }

    record FriendStreakAtRisk(String nickname, int days) implements PushNotification {
        public PushCategory category() {
            return PushCategory.FRIENDS;
        }

        public String path() {
            return "/streak";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Your friend streak is at risk", nickname + " played today. Play too to keep your "
                            + days + "-day streak together!")
                    : new Text("Votre série à deux est en danger", nickname + " a joué aujourd'hui. Joue aussi pour garder "
                            + "vos " + days + " jour" + (days > 1 ? "s" : "") + " de série !");
        }
    }

    record FriendStreakMilestone(String nickname, int days) implements PushNotification {
        public PushCategory category() {
            return PushCategory.FRIENDS;
        }

        public String path() {
            return "/streak";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text(days + " days together!", "You and " + nickname + " reached a " + days + "-day friend streak.")
                    : new Text(days + " jours ensemble !", "Toi et " + nickname + " avez atteint " + days + " jours de série à deux.");
        }
    }

    record RewardsUnclaimed() implements PushNotification {
        public PushCategory category() {
            return PushCategory.EVENTS;
        }

        public String path() {
            return "/missions";
        }

        public Text text(String locale) {
            return english(locale)
                    ? new Text("Rewards to claim", "You completed missions today: collect your rewards before they expire.")
                    : new Text("Des récompenses t'attendent", "Tu as terminé des missions aujourd'hui : récupère tes récompenses avant minuit.");
        }
    }
}
