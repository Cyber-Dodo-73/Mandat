-- Remote push notifications (Expo push service). Migration range V100-V109.

-- One row per installed app: the Expo push token identifies the device.
create table push_devices (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid        not null references users (id) on delete cascade,
    token        text        not null unique,
    platform     text        not null check (platform in ('ios', 'android')),
    locale       text        not null default 'fr',
    enabled      boolean     not null default true,
    created_at   timestamptz not null,
    last_seen_at timestamptz not null
);

create index push_devices_user_idx on push_devices (user_id) where enabled;

-- Per-category opt-ins. Marketing is off until the player explicitly opts in.
create table push_preferences (
    user_id       uuid primary key references users (id) on delete cascade,
    booster_ready boolean     not null default true,
    streak        boolean     not null default true,
    friends       boolean     not null default true,
    events        boolean     not null default true,
    marketing     boolean     not null default false,
    updated_at    timestamptz not null
);

-- Every notification sent: dedupe (one per key and player) and the daily frequency caps.
create table push_notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid        not null references users (id) on delete cascade,
    category    text        not null,
    dedupe_key  text        not null,
    -- Calendar day in the player's timezone, for the per-day caps.
    local_day   date        not null,
    transactional boolean   not null,
    sent_at     timestamptz not null,
    unique (user_id, dedupe_key)
);

create index push_notifications_user_day_idx on push_notifications (user_id, local_day);

-- Expo push tickets waiting for their receipt (dead tokens are disabled from receipts).
create table push_tickets (
    ticket_id  text primary key,
    token      text        not null,
    created_at timestamptz not null
);

-- Minimal distributed lock so a scheduled job never runs twice at once across instances.
create table scheduler_locks (
    name         text primary key,
    locked_until timestamptz not null,
    locked_by    text        not null
);
