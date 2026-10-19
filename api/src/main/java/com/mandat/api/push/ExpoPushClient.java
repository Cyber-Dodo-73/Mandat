package com.mandat.api.push;

import java.util.List;
import java.util.Map;

/** Expo push service (https://docs.expo.dev/push-notifications/sending-notifications/). */
public interface ExpoPushClient {

    /** Max messages per send request accepted by Expo. */
    int MAX_BATCH = 100;

    /** Expo error code of a token that no longer exists (app uninstalled, token rotated). */
    String DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

    /** Sends up to {@link #MAX_BATCH} messages; tickets come back in the same order. */
    List<Ticket> send(List<Message> messages);

    /** Receipts by ticket id (ids whose receipt is not ready yet are missing). */
    Map<String, Receipt> receipts(List<String> ticketIds);

    record Message(String to, String title, String body, Map<String, String> data) {}

    /** {@code status} is "ok" (with an id) or "error" (with the Expo error code). */
    record Ticket(String status, String id, String error) {
        public boolean ok() {
            return "ok".equals(status);
        }
    }

    record Receipt(String status, String error) {}
}
