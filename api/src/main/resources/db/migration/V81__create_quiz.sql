-- Quiz sessions: questions are generated server-side and stored with their answers, which are never
-- sent to the client before the question is answered.
create table quiz_sessions (
    id             uuid primary key,
    user_id        uuid        not null references users (id) on delete cascade,
    language       text        not null check (language in ('fr', 'en')),
    -- generated questions, answers included (server only)
    questions      jsonb       not null,
    status         text        not null check (status in ('active', 'completed', 'expired')),
    lives          integer     not null check (lives >= 0),
    answered_count integer     not null default 0,
    correct_count  integer     not null default 0,
    -- rewards granted when the session completed (replayed answers return them unchanged)
    reward_influence  integer,
    reward_bonus_pack boolean,
    created_at     timestamptz not null,
    expires_at     timestamptz not null,
    completed_at   timestamptz
);

create index quiz_sessions_user_idx on quiz_sessions (user_id, created_at desc);

create table quiz_answers (
    session_id     uuid        not null references quiz_sessions (id) on delete cascade,
    question_index integer     not null,
    answer         jsonb       not null,
    correct        boolean     not null,
    answered_at    timestamptz not null,
    primary key (session_id, question_index)
);

-- Perfect quizzes, for the "one bonus booster every 5 perfect quizzes" reward.
create table quiz_player_stats (
    user_id       uuid primary key references users (id) on delete cascade,
    perfect_count integer not null default 0
);
