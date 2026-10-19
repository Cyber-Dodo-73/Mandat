-- Append-only journal of every wallet movement, with the domain that caused it.
-- Lets support/anti-cheat audit balances and lets each domain verify its own effect.
create table wallet_ledger (
    id         bigserial primary key,
    user_id    uuid        not null references users (id) on delete cascade,
    currency   text        not null check (currency in ('influence', 'bonus_packs')),
    delta      integer     not null check (delta <> 0),
    source     text        not null,
    created_at timestamptz not null default now()
);

create index wallet_ledger_user_idx on wallet_ledger (user_id, created_at);
