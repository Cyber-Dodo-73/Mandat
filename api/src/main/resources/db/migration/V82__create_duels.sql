-- Duels against the AI, best of 3, resolved server-side round by round.
create table duels (
    id             uuid primary key,
    user_id        uuid        not null references users (id) on delete cascade,
    difficulty     text        not null check (difficulty in ('easy', 'normal', 'hard')),
    status         text        not null check (status in ('active', 'finished', 'abandoned')),
    player_cards   text[]      not null,
    ai_cards       text[]      not null,
    player_score   integer     not null default 0,
    ai_score       integer     not null default 0,
    rounds_played  integer     not null default 0,
    -- domain of the next round, announced before the player picks a card
    next_domain    text check (next_domain in ('influence', 'diplomacy', 'charisma', 'strategy')),
    winner         text check (winner in ('player', 'ai', 'draw')),
    created_at     timestamptz not null,
    finished_at    timestamptz
);

create index duels_user_idx on duels (user_id, created_at desc);

create table duel_rounds (
    duel_id        uuid        not null references duels (id) on delete cascade,
    round_number   integer     not null check (round_number between 1 and 3),
    domain         text        not null,
    player_card    text        not null,
    ai_card        text        not null,
    -- full resolution (values, applied effects, winner), as returned to the client
    outcome        jsonb       not null,
    played_at      timestamptz not null,
    primary key (duel_id, round_number)
);
