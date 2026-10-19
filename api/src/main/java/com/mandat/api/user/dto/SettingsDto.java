package com.mandat.api.user.dto;

import com.mandat.api.user.User;

public record SettingsDto(
        String language,
        String timezone,
        boolean sound,
        boolean haptics,
        boolean notifications,
        ReduceMotion reduceMotion) {

    public static SettingsDto from(User user) {
        return new SettingsDto(
                user.getLocale(),
                user.getTimezone(),
                user.isSoundEnabled(),
                user.isHapticsEnabled(),
                user.isNotificationsEnabled(),
                ReduceMotion.fromColumn(user.getReduceMotion()));
    }
}
