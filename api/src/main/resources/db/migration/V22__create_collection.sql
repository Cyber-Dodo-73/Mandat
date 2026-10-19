-- Owned cards: one row per (player, card, finish). Rows are kept at quantity >= 1.
create table collection_items (
    user_id           uuid        not null references users (id) on delete cascade,
    card_id           text        not null references cards (id),
    finish            text        not null check (finish in ('standard', 'holo', 'full_art', 'gold')),
    quantity          integer     not null check (quantity >= 1),
    first_obtained_at timestamptz not null,
    last_obtained_at  timestamptz not null,
    primary key (user_id, card_id, finish)
);
