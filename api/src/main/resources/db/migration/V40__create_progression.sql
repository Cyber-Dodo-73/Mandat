-- Progression domain: XP and levels, streak, season pass XP, activity counters, unlocks,
-- missions, achievements and season pass claims. Rows are created lazily per player.

create table player_progress (
    user_id          uuid primary key references users (id) on delete cascade,
    total_xp         integer     not null default 0 check (total_xp >= 0),
    level            integer     not null default 1 check (level >= 1),
    season_id        text        not null,
    season_xp        integer     not null default 0 check (season_xp >= 0),
    current_streak   integer     not null default 0 check (current_streak >= 0),
    best_streak      integer     not null default 0 check (best_streak >= 0),
    -- Last calendar day (player timezone) with a streak activity.
    last_active_day  date,
    -- ISO week (e.g. 2026-W43) whose free streak freeze has been used.
    last_freeze_week text,
    updated_at       timestamptz not null default now()
);

-- Lifetime counters feeding achievements.
create table player_stats (
    user_id           uuid primary key references users (id) on delete cascade,
    packs_opened      integer not null default 0,
    new_cards         integer not null default 0,
    rare_plus_pulled  integer not null default 0,
    quizzes_completed integer not null default 0,
    perfect_quizzes   integer not null default 0,
    duels_played      integer not null default 0,
    duels_won         integer not null default 0,
    cards_recycled    integer not null default 0,
    cards_crafted     integer not null default 0
);

-- Cosmetics unlocked by levels, achievements and the season pass (ids map to client assets/i18n).
create table player_unlocks (
    user_id     uuid        not null references users (id) on delete cascade,
    kind        text        not null check (kind in ('avatar', 'banner', 'title')),
    item_id     text        not null,
    source      text        not null,
    unlocked_at timestamptz not null,
    primary key (user_id, kind, item_id)
);

create table player_missions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid        not null references users (id) on delete cascade,
    period       text        not null check (period in ('daily', 'weekly')),
    -- 'D:2026-10-19' or 'W:2026-W43', in the player's timezone.
    period_key   text        not null,
    template_id  text        not null,
    type         text        not null,
    param        text,
    target       integer     not null check (target > 0),
    progress     integer     not null default 0 check (progress >= 0),
    completed_at timestamptz,
    claimed_at   timestamptz,
    unique (user_id, period_key, template_id)
);

create index player_missions_user_period_idx on player_missions (user_id, period_key);

create table player_achievements (
    user_id        uuid        not null references users (id) on delete cascade,
    achievement_id text        not null,
    unlocked_at    timestamptz not null,
    primary key (user_id, achievement_id)
);

create table season_pass_claims (
    user_id    uuid        not null references users (id) on delete cascade,
    season_id  text        not null,
    tier       integer     not null check (tier > 0),
    claimed_at timestamptz not null,
    primary key (user_id, season_id, tier)
);
