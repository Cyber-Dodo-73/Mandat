/**
 * Game events published with {@code ApplicationEventPublisher} so progression (XP, missions,
 * achievements, streak) reacts without coupling domains. Listeners use
 * {@code @TransactionalEventListener} or {@code @EventListener} inside the publishing transaction.
 */
package com.mandat.api.common.events;
