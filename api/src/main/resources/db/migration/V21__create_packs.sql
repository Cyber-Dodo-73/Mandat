-- Per-player booster state. Free boosters accrue lazily from free_packs_anchor (see FreePackTimer):
-- available = min(max_stock, floor((now - anchor) / interval)).
create table pack_states (
    user_id                 uuid primary key references users (id) on delete cascade,
    free_packs_anchor       timestamptz not null,
    packs_opened            integer     not null default 0 check (packs_opened >= 0),
    packs_since_epic        integer     not null default 0 check (packs_since_epic >= 0),
    packs_since_legendary   integer     not null default 0 check (packs_since_legendary >= 0)
);

-- Every opening, keyed by the client Idempotency-Key: a replay returns the stored response.
create table pack_openings (
    id              uuid primary key,
    user_id         uuid        not null references users (id) on delete cascade,
    pack_id         text        not null,
    idempotency_key text        not null,
    response        text        not null,
    opened_at       timestamptz not null,
    unique (user_id, idempotency_key)
);
