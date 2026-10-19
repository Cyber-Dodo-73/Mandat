package com.mandat.api.common.wallet;

/** Why a wallet balance moved; stored in wallet_ledger.source. */
public enum WalletSource {
    PACK_DUPLICATES("pack.duplicates"),
    PACK_OPEN("pack.open"),
    RECYCLE("collection.recycle"),
    CRAFT("collection.craft"),
    FINISH_UPGRADE("collection.upgrade"),
    LEVEL_REWARD("progression.level"),
    PROGRESSION_REWARD("progression.reward"),
    QUIZ_REWARD("quiz.reward"),
    DUEL_REWARD("duel.reward");

    private final String key;

    WalletSource(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
