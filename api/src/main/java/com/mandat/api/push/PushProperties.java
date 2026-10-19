package com.mandat.api.push;

import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Remote push settings ({@code mandat.push.*}).
 *
 * @param enabled             false turns every send into a no-op (devices are still registered)
 * @param expoAccessToken     optional Expo access token, required only when "enhanced push security" is on
 * @param sendUrl             Expo push send endpoint
 * @param receiptsUrl         Expo push receipts endpoint
 * @param jobsEnabled         runs the scheduled jobs (off in tests, which call them directly)
 * @param dailyCap            max notifications per player and local day, all categories
 * @param reminderDailyCap    max non-transactional notifications per player and local day
 * @param quietStartHour      local hour from which nothing is sent…
 * @param quietEndHour        …until this local hour (deferred notifications go out after it)
 * @param streakReminderHour  local hour of the "streak at risk" reminder
 * @param rewardsReminderHour local hour of the "unclaimed rewards" reminder
 * @param receiptDelay        wait before asking Expo for a ticket's receipt
 */
@ConfigurationProperties(prefix = "mandat.push")
public record PushProperties(
        @DefaultValue("true") boolean enabled,
        String expoAccessToken,
        @DefaultValue("https://exp.host/--/api/v2/push/send") URI sendUrl,
        @DefaultValue("https://exp.host/--/api/v2/push/getReceipts") URI receiptsUrl,
        @DefaultValue("true") boolean jobsEnabled,
        @DefaultValue("2") int dailyCap,
        @DefaultValue("1") int reminderDailyCap,
        @DefaultValue("22") int quietStartHour,
        @DefaultValue("9") int quietEndHour,
        @DefaultValue("20") int streakReminderHour,
        @DefaultValue("18") int rewardsReminderHour,
        @DefaultValue("PT15M") Duration receiptDelay) {

    public boolean hasAccessToken() {
        return expoAccessToken != null && !expoAccessToken.isBlank();
    }

    /** True when {@code hour} (local) is inside the quiet window, e.g. 22:00–09:00. */
    public boolean isQuietHour(int hour) {
        return quietStartHour > quietEndHour
                ? hour >= quietStartHour || hour < quietEndHour
                : hour >= quietStartHour && hour < quietEndHour;
    }
}
