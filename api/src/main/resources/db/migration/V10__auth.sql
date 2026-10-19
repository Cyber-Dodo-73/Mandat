-- Account, credentials, social identities and settings of a player.
-- Deleting a user is a hard delete (DELETE /me, GDPR / App Store): every table referencing
-- users(id) in any domain MUST declare "on delete cascade".
alter table users
    add column email                 citext unique,
    add column password_hash         text,
    add column nickname              citext not null unique
        check (char_length(nickname) between 3 and 20),
    add column friend_code           text   not null unique
        check (friend_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
    add column apple_sub             text unique,
    add column google_sub            text unique,
    add column sound_enabled         boolean not null default true,
    add column haptics_enabled       boolean not null default true,
    add column notifications_enabled boolean not null default true,
    -- null = follow the device "reduce motion" setting.
    add column reduce_motion         boolean,
    add column updated_at            timestamptz not null default now(),
    add constraint users_has_login check (
        password_hash is not null or apple_sub is not null or google_sub is not null);

-- Opaque refresh tokens (only their SHA-256 is stored), rotated on every use.
-- All tokens issued from one login share a family: presenting an already used token
-- revokes the whole family (theft detection).
create table refresh_tokens (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid        not null references users (id) on delete cascade,
    family_id    uuid        not null,
    token_hash   bytea       not null unique,
    device_label text,
    created_at   timestamptz not null,
    expires_at   timestamptz not null,
    revoked_at   timestamptz
);

create index refresh_tokens_family_idx on refresh_tokens (family_id);
create index refresh_tokens_user_idx on refresh_tokens (user_id);
