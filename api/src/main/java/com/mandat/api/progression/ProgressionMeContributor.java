package com.mandat.api.progression;

import com.mandat.api.user.MeContributor;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Adds the progression summary (level, XP, streak, resets) to GET /me. */
@Component
class ProgressionMeContributor implements MeContributor {

    private final ProgressionSummaryService summaries;

    ProgressionMeContributor(ProgressionSummaryService summaries) {
        this.summaries = summaries;
    }

    @Override
    public String key() {
        return "progression";
    }

    /** GET /me runs read-only; the lazy progress row creation needs its own write transaction. */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ProgressionResponse contribute(UUID userId) {
        return summaries.summary(userId);
    }
}
