package com.mandat.api.common.wallet;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Shared wallet (Influence + bonus boosters) stored on the users row. Every mutation joins the
 * caller's transaction and uses a single conditional UPDATE so balances never go negative.
 */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class WalletService {

    private final JdbcClient jdbc;

    public WalletService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void addInfluence(UUID userId, int amount) {
        requirePositive(amount);
        jdbc.sql("update users set influence = influence + :amount where id = :id")
                .param("amount", amount).param("id", userId).update();
    }

    public void spendInfluence(UUID userId, int amount) {
        requirePositive(amount);
        int updated = jdbc.sql("update users set influence = influence - :amount where id = :id and influence >= :amount")
                .param("amount", amount).param("id", userId).update();
        if (updated == 0) {
            throw new ApiException(ErrorCode.INSUFFICIENT_INFLUENCE);
        }
    }

    public void addBonusPacks(UUID userId, int count) {
        requirePositive(count);
        jdbc.sql("update users set bonus_packs = bonus_packs + :count where id = :id")
                .param("count", count).param("id", userId).update();
    }

    /** Returns false when the user has no bonus booster left. */
    public boolean consumeBonusPack(UUID userId) {
        return jdbc.sql("update users set bonus_packs = bonus_packs - 1 where id = :id and bonus_packs > 0")
                .param("id", userId).update() == 1;
    }

    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public Balance balance(UUID userId) {
        return jdbc.sql("select influence, bonus_packs from users where id = :id")
                .param("id", userId)
                .query((rs, row) -> new Balance(rs.getInt("influence"), rs.getInt("bonus_packs")))
                .single();
    }

    private static void requirePositive(int value) {
        if (value <= 0) {
            throw new IllegalArgumentException("Wallet amounts must be positive");
        }
    }

    public record Balance(int influence, int bonusPacks) {}
}
