package com.mandat.api.common.wallet;

/** Why a wallet balance moved; stored in wallet_ledger.source. */
public enum WalletSource {
    PACK_DUPLICATES("pack.duplicates"),
    PACK_OPEN("pack.open"),
    RECYCLE("collection.recycle"),
    CRAFT("collection.craft"),
    LEVEL_REWARD("progression.level"),
    PROGRESSION_REWARD("progression.reward");

    private final String key;

    WalletSource(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }
}
