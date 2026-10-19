package com.mandat.api.common.entitlement;

import java.util.UUID;
import org.springframework.stereotype.Component;

/** Default provider while no payment integration exists: everyone plays the free game. */
@Component
public class FreeEntitlementProvider implements EntitlementProvider {

    @Override
    public Entitlement entitlementOf(UUID userId) {
        return Entitlement.FREE;
    }
}
