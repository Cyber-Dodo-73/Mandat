-- Launch compliance: email verification state, terms acceptance, moderation (roles, bans, blocks,
-- report handling), password reset and Sign in with Apple revocation.

-- An email is "verified" when a provider vouched for it at sign-up (social account) or when its
-- owner proved control of the mailbox (password reset link). Only verified emails can be matched
-- to a social sign-in.
alter table users
    add column email_verified     boolean     not null default false,
    add column terms_version      text,
    add column terms_accepted_at  timestamptz,
    add column age_confirmed_at   timestamptz,
    add column role               text        not null default 'player' check (role in ('player', 'admin')),
    add column banned_at          timestamptz,
    add column ban_reason         text check (char_length(ban_reason) <= 280),
    -- Apple refresh token (AES-GCM encrypted, base64), only used to revoke the authorization on deletion.
    add column apple_refresh_token text;

-- Social-only accounts stored their email only when the provider marked it verified.
update users set email_verified = true where email is not null and password_hash is null;

create table password_reset_tokens (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid        not null references users (id) on delete cascade,
    token_hash bytea       not null unique,
    created_at timestamptz not null,
    expires_at timestamptz not null,
    used_at    timestamptz
);

create index password_reset_tokens_user_idx on password_reset_tokens (user_id);

create table player_blocks (
    blocker_id uuid        not null references users (id) on delete cascade,
    blocked_id uuid        not null references users (id) on delete cascade,
    created_at timestamptz not null,
    primary key (blocker_id, blocked_id),
    check (blocker_id <> blocked_id)
);

create index player_blocks_blocked_idx on player_blocks (blocked_id);

alter table reports
    add column handled_at timestamptz,
    add column handled_by uuid references users (id) on delete set null,
    add column resolution text check (resolution in ('none', 'banned', 'renamed'));

create index reports_open_idx on reports (created_at) where status = 'open';
