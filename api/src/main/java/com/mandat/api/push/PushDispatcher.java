package com.mandat.api.push;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Runs event-driven sends off the request thread (virtual threads): a slow or failing Expo call
 * never delays nor fails the player's action. Tests swap it for a synchronous one.
 */
@Component
public class PushDispatcher {

    private static final Logger log = LoggerFactory.getLogger(PushDispatcher.class);

    private final Executor executor;

    public PushDispatcher() {
        this(Executors.newVirtualThreadPerTaskExecutor());
    }

    public PushDispatcher(Executor executor) {
        this.executor = executor;
    }

    public void dispatch(Runnable send) {
        executor.execute(() -> {
            try {
                send.run();
            } catch (RuntimeException e) {
                log.warn("Push dispatch failed: {}", e.getClass().getSimpleName());
            }
        });
    }
}
