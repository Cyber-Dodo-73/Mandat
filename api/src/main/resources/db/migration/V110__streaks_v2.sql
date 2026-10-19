-- Duolingo-style streaks: freeze inventory, repair, calendar history, milestones, friend streaks,
-- friend nudges and a push outbox for notifications deferred by quiet hours.

-- Freeze inventory (earned weekly, from milestones, or bought), max 2 stocked. last_freeze_week now
-- records the ISO week whose free weekly freeze was granted.
alter table player_progress
    add column freezes           integer not null default 0 check (freezes between 0 and 2),
    -- Last lost streak, for the repair offer: its length, the last active day before the loss and
    -- whether it qualifies (a single uncovered missed day).
    add column lost_streak       integer not null default 0 check (lost_streak >= 0),
    add column lost_after        date,
    add column lost_repairable   boolean not null default false,
    -- Month (e.g. 2026-10) of the last repair: one repair per calendar month.
    add column last_repair_month text;

-- One row per calendar day (player timezone) kept by an activity or protected by a freeze/repair.
create table streak_days (
    user_id uuid not null references users (id) on delete cascade,
    day     date not null,
    status  text not null check (status in ('active', 'frozen')),
    primary key (user_id, day)
);

-- History starts with the migration: keep each player's last active day.
insert into streak_days (user_id, day, status)
select user_id, last_active_day, 'active' from player_progress where last_active_day is not null;

-- Individual streak milestones already rewarded (rewards are granted once per lifetime).
create table streak_milestone_rewards (
    user_id    uuid        not null references users (id) on delete cascade,
    milestone  integer     not null,
    granted_at timestamptz not null,
    primary key (user_id, milestone)
);

-- Freeze purchases, idempotent per Idempotency-Key.
create table streak_freeze_purchases (
    user_id         uuid        not null references users (id) on delete cascade,
    idempotency_key text        not null,
    currency        text        not null,
    price           integer     not null,
    freezes_after   integer     not null,
    created_at      timestamptz not null,
    primary key (user_id, idempotency_key)
);

-- Friend streaks: one row per pair (user_a < user_b), pending until the invitee accepts.
create table friend_streaks (
    id              uuid primary key default gen_random_uuid(),
    user_a          uuid        not null references users (id) on delete cascade,
    user_b          uuid        not null references users (id) on delete cascade,
    requested_by    uuid        not null references users (id) on delete cascade,
    status          text        not null check (status in ('pending', 'active')),
    current         integer     not null default 0 check (current >= 0),
    best            integer     not null default 0 check (best >= 0),
    -- Last calendar day both players were active (each counted in their own timezone).
    last_shared_day date,
    best_milestone  integer     not null default 0,
    created_at      timestamptz not null,
    accepted_at     timestamptz,
    check (user_a < user_b),
    unique (user_a, user_b)
);

create index friend_streaks_user_b_idx on friend_streaks (user_b);

-- "X te relance !": at most one nudge per sender → friend and sender's local day.
create table friend_nudges (
    sender_id   uuid        not null references users (id) on delete cascade,
    receiver_id uuid        not null references users (id) on delete cascade,
    sender_day  date        not null,
    created_at  timestamptz not null,
    primary key (sender_id, receiver_id, sender_day)
);

create index friend_nudges_sender_day_idx on friend_nudges (sender_id, sender_day);

-- Event-driven pushes waiting for the end of the receiver's quiet hours (or sent right away).
create table push_outbox (
    id         bigserial primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    kind       text        not null,
    arg_text   text,
    arg_int    integer,
    dedupe_key text        not null,
    created_at timestamptz not null,
    expires_at timestamptz not null,
    done_at    timestamptz,
    outcome    text,
    unique (user_id, dedupe_key)
);

create index push_outbox_pending_idx on push_outbox (created_at) where done_at is null;

-- Players can mute nudges from friends.
alter table push_preferences add column nudges boolean not null default true;
