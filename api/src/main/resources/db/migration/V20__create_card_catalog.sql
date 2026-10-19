-- Card catalog, seeded at startup from data/cards.season<N>.json (CardCatalogSeeder).
-- Cards are never deleted: a card dropped from the file is deactivated, so owned copies stay valid.
create table cards (
    id                  text primary key,
    season              integer          not null,
    number              integer          not null,
    wikidata_id         text             not null,
    name_fr             text             not null,
    name_en             text             not null,
    role_fr             text             not null,
    role_en             text             not null,
    country             text             not null,
    continent           text             not null check (continent in ('africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania')),
    era                 text             not null check (era in ('antiquity', 'medieval', 'modern', 'contemporary')),
    birth_year          integer,
    death_year          integer,
    is_living           boolean          not null,
    fame_score          double precision not null,
    rarity              text             not null check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
    bio_fr              text             not null,
    bio_en              text             not null,
    stat_influence      integer          not null check (stat_influence between 1 and 10),
    stat_diplomacy      integer          not null check (stat_diplomacy between 1 and 10),
    stat_charisma       integer          not null check (stat_charisma between 1 and 10),
    stat_strategy       integer          not null check (stat_strategy between 1 and 10),
    ability_name_fr     text             not null,
    ability_name_en     text             not null,
    ability_desc_fr     text             not null,
    ability_desc_en     text             not null,
    sensitive           boolean          not null,
    artwork             text,
    active              boolean          not null default true,
    unique (season, number)
);

create index cards_draw_pool_idx on cards (season, active, rarity);

-- One row per season: hash of the last seeded file, used for idempotent seeding and the catalog ETag.
create table catalog_versions (
    season       integer primary key,
    content_hash text        not null,
    card_count   integer     not null,
    seeded_at    timestamptz not null
);
