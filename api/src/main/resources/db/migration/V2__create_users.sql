-- Core user row shared by every domain. Auth-specific columns are added by the auth migrations.
-- Migration version ranges per domain: auth/user V10-V19, card/pack/collection V20-V39,
-- progression V40-V59, profile/social V60-V79, quiz/duel V80-V99.
create table users (
    id         uuid primary key default gen_random_uuid(),
    timezone   text        not null default 'Europe/Paris',
    locale     text        not null default 'fr',
    -- Shared wallet: soft currency and boosters granted by rewards (free timed packs live in the pack domain).
    influence   integer    not null default 0 check (influence >= 0),
    bonus_packs integer    not null default 0 check (bonus_packs >= 0),
    created_at timestamptz not null default now()
);
