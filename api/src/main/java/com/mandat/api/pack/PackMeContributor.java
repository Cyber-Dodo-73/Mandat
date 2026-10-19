package com.mandat.api.pack;

import com.mandat.api.pack.dto.PackDtos.FreePacksDto;
import com.mandat.api.pack.dto.PackDtos.PacksResponse;
import com.mandat.api.pack.dto.PackDtos.PityDto;
import com.mandat.api.user.MeContributor;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Adds free-pack timers, bonus boosters and pity counters to GET /me. */
@Component
class PackMeContributor implements MeContributor {

    private final PackService packs;

    PackMeContributor(PackService packs) {
        this.packs = packs;
    }

    @Override
    public String key() {
        return "packs";
    }

    /** GET /me runs read-only; the lazy state initialisation needs its own write transaction. */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public MePacksSection contribute(UUID userId) {
        PacksResponse overview = packs.overview(userId);
        return new MePacksSection(overview.freePacks(), overview.bonusPacks(), overview.pity());
    }

    public record MePacksSection(FreePacksDto freePacks, int bonusPacks, PityDto pity) {}
}
