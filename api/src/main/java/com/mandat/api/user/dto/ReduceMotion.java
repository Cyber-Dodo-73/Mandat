package com.mandat.api.user.dto;

/** "Reduce motion" preference; SYSTEM follows the device accessibility setting. */
public enum ReduceMotion {
    SYSTEM,
    ON,
    OFF;

    public Boolean toColumn() {
        return switch (this) {
            case SYSTEM -> null;
            case ON -> Boolean.TRUE;
            case OFF -> Boolean.FALSE;
        };
    }

    public static ReduceMotion fromColumn(Boolean value) {
        if (value == null) {
            return SYSTEM;
        }
        return value ? ON : OFF;
    }
}
