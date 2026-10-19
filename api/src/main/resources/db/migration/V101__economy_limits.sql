-- Economy pacing (2026-10-19): daily reward caps for quizzes and duel wins, and a crafting allowance
-- (1 craft every 48 h, stock 3). Numbered after V100 because production is already past it.
alter table quiz_sessions add column rewarded boolean not null default false;

alter table duels add column rewarded boolean not null default false;
-- Influence actually granted when the duel finished (0 when the daily cap was reached).
alter table duels add column reward_influence integer;
alter table duels add column reward_capped boolean not null default false;

create index quiz_sessions_rewarded_day on quiz_sessions (user_id, completed_at) where rewarded;
create index duels_rewarded_day on duels (user_id, finished_at) where rewarded;

create table craft_allowances (
    user_id uuid        primary key references users (id) on delete cascade,
    anchor  timestamptz not null
);
