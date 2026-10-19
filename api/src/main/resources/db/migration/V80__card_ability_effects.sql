-- Machine-readable duel effect of each card ability (data/content/GUIDELINES.md).
alter table cards
    add column effect_type            text check (effect_type in ('bonus', 'malus', 'tieBreaker')),
    add column effect_stat            text check (effect_stat in ('influence', 'diplomacy', 'charisma', 'strategy', 'any')),
    add column effect_amount          integer check (effect_amount between 1 and 3),
    add column effect_condition       text check (effect_condition in ('always', 'opponentContinent', 'opponentEra',
                                                   'roundDomain', 'round', 'behind', 'opponentRarityHigher')),
    add column effect_condition_value text;

-- Forget the seeded file hashes so the next startup re-seeds and fills the effects.
delete from catalog_versions;
