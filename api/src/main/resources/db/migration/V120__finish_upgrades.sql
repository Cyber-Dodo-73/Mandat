-- Finish upgrades (standard -> holo for Influence), idempotent per player and Idempotency-Key:
-- a replay returns the stored response instead of spending again.
create table finish_upgrades (
    user_id         uuid        not null references users (id) on delete cascade,
    idempotency_key text        not null,
    card_id         text        not null,
    response        jsonb       not null,
    created_at      timestamptz not null default now(),
    primary key (user_id, idempotency_key)
);
