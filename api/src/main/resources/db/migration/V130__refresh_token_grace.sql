-- Refresh rotation grace: a used token whose direct successor was never presented can be
-- accepted once more (the client lost the rotation response: connection dropped, app killed,
-- keychain write refused). Each grace use is recorded so a family cannot be replayed forever.
alter table refresh_tokens
    add column parent_id uuid references refresh_tokens (id) on delete set null,
    add column reused_at timestamptz;

create index refresh_tokens_family_live_idx on refresh_tokens (family_id) where revoked_at is null;
