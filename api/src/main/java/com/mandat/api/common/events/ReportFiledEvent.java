package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** A player reported a profile; carries no personal data so it can be relayed to an alert channel. */
public record ReportFiledEvent(UUID reportId, String reason, Instant at) {}
