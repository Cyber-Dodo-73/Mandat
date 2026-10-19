package com.mandat.api.support;

import com.mandat.api.push.ExpoPushClient;
import com.mandat.api.push.PushDispatcher;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Fake Expo client and synchronous dispatcher shared by the tests that check pushes. */
public final class PushTestSupport {

    private PushTestSupport() {}

    /** Records sends; per-token errors on tickets or receipts. */
    public static final class FakeExpoPushClient implements ExpoPushClient {

        public final List<Message> sent = new CopyOnWriteArrayList<>();
        public final Map<String, String> ticketErrors = new HashMap<>();
        public final Map<String, String> receiptErrors = new HashMap<>();
        private final Map<String, String> tokenByTicket = new HashMap<>();
        private final AtomicInteger ids = new AtomicInteger();

        public void reset() {
            sent.clear();
            ticketErrors.clear();
            receiptErrors.clear();
            tokenByTicket.clear();
        }

        @Override
        public List<Ticket> send(List<Message> messages) {
            List<Ticket> tickets = new ArrayList<>();
            for (Message message : messages) {
                sent.add(message);
                String error = ticketErrors.get(message.to());
                if (error != null) {
                    tickets.add(new Ticket("error", null, error));
                } else {
                    String id = "ticket-" + ids.incrementAndGet();
                    tokenByTicket.put(id, message.to());
                    tickets.add(new Ticket("ok", id, null));
                }
            }
            return tickets;
        }

        @Override
        public Map<String, Receipt> receipts(List<String> ticketIds) {
            Map<String, Receipt> receipts = new HashMap<>();
            for (String id : ticketIds) {
                String error = receiptErrors.get(tokenByTicket.get(id));
                receipts.put(id, error == null ? new Receipt("ok", null) : new Receipt("error", error));
            }
            return receipts;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    public static class PushTestBeans {

        @Bean
        @Primary
        FakeExpoPushClient fakeExpoPushClient() {
            return new FakeExpoPushClient();
        }

        @Bean
        @Primary
        PushDispatcher synchronousPushDispatcher() {
            return new PushDispatcher(Runnable::run);
        }
    }
}
