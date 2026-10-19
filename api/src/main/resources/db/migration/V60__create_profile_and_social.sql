-- Profile & social (phase 8). Every reference to users(id) cascades: DELETE /me is a hard delete.

-- Last nickname change, for the change cooldown (null = never changed since sign-up).
alter table users add column nickname_changed_at timestamptz;

-- Public profile settings. Created lazily on first access with the default cosmetics.
create table profiles (
    user_id          uuid primary key references users (id) on delete cascade,
    avatar_id        text        not null default 'avatar.starter_1',
    banner_id        text        not null default 'banner.default',
    title_id         text,
    favorite_card_id text references cards (id),
    favorite_finish  text check (favorite_finish in ('standard', 'holo', 'full_art', 'gold')),
    visibility       text        not null default 'public' check (visibility in ('public', 'private')),
    updated_at       timestamptz not null default now(),
    check ((favorite_card_id is null) = (favorite_finish is null))
);

-- Showcase: up to 6 owned card + finish pairs, in display order.
create table profile_showcase (
    user_id  uuid     not null references users (id) on delete cascade,
    position smallint not null check (position between 0 and 5),
    card_id  text     not null references cards (id),
    finish   text     not null check (finish in ('standard', 'holo', 'full_art', 'gold')),
    primary key (user_id, position),
    unique (user_id, card_id, finish)
);

-- Friendships, mutual-request model: a pending row from requester to addressee becomes
-- 'accepted' when the addressee accepts (or sends a request back).
create table friendships (
    requester_id uuid        not null references users (id) on delete cascade,
    addressee_id uuid        not null references users (id) on delete cascade,
    status       text        not null check (status in ('pending', 'accepted')),
    created_at   timestamptz not null,
    accepted_at  timestamptz,
    primary key (requester_id, addressee_id),
    check (requester_id <> addressee_id)
);
create index friendships_addressee_idx on friendships (addressee_id);
-- At most one row per pair, whatever the direction.
create unique index friendships_pair_idx on friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- Profile reports, for moderation only (never exposed publicly).
create table reports (
    id          uuid primary key default gen_random_uuid(),
    reporter_id uuid        not null references users (id) on delete cascade,
    target_id   uuid        not null references users (id) on delete cascade,
    reason      text        not null check (reason in ('offensive_nickname', 'inappropriate_profile', 'cheating', 'harassment', 'other')),
    note        text check (char_length(note) <= 280),
    status      text        not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
    created_at  timestamptz not null,
    check (reporter_id <> target_id)
);
create index reports_target_idx on reports (target_id, created_at desc);
