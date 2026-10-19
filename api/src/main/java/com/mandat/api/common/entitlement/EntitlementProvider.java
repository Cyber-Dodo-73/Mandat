package com.mandat.api.common.entitlement;

import java.util.UUID;

/**
 * Resolves a player's entitlement. Until real-money purchases exist every player is free
 * ({@link FreeEntitlementProvider}); the subscription integration only has to declare a
 * {@code @Primary} bean of this type backed by its entitlements table.
 */
public interface EntitlementProvider {

    Entitlement entitlementOf(UUID userId);
}
