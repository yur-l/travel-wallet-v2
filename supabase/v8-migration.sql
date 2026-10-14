-- =========================================================
-- Travel Wallet V8 migration
-- Run ONCE in the existing Supabase project before deploying V8.
-- Adds:
--   - expense categories
--   - 14-day soft delete / restore
--   - member management permissions
-- =========================================================

-- 1) New columns -----------------------------------------------------------
alter table public.wallets
  add column if not exists deleted_at timestamptz;

alter table public.transactions
  add column if not exists category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_category_check'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_category_check
      CHECK (category IS NULL OR category IN ('food','transport','shopping'));
  END IF;
END $$;

create index if not exists wallets_deleted_at_idx on public.wallets(deleted_at);
create index if not exists transactions_category_idx on public.transactions(wallet_id, category);

-- 2) Profile visibility: any wallet member may see a pending requester -----
create or replace function public.can_view_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.wallet_members mine
      join public.wallet_members theirs
        on theirs.wallet_id = mine.wallet_id
      where mine.user_id = auth.uid()
        and theirs.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.wallet_join_requests request
      where request.user_id = p_profile_id
        and request.status = 'pending'
        and public.is_wallet_member(request.wallet_id, auth.uid())
    );
$$;

-- 3) Join-by-code ignores wallets waiting for permanent deletion -----------
create or replace function public.request_join_wallet(
  p_invite_code text
)
returns table (
  wallet_id uuid,
  wallet_name text,
  request_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_wallet public.wallets%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select w.*
  into target_wallet
  from public.wallets as w
  where w.invite_code = upper(trim(p_invite_code))
    and w.deleted_at is null
  limit 1;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  if exists (
    select 1
    from public.wallet_members as wm
    where wm.wallet_id = target_wallet.id
      and wm.user_id = current_user_id
  ) then
    return query
    select target_wallet.id, target_wallet.name, 'already_member'::text;
    return;
  end if;

  if exists (
    select 1
    from public.wallet_join_requests as wjr
    where wjr.wallet_id = target_wallet.id
      and wjr.user_id = current_user_id
      and wjr.status = 'pending'
  ) then
    return query
    select target_wallet.id, target_wallet.name, 'pending'::text;
    return;
  end if;

  insert into public.wallet_join_requests (wallet_id, user_id, status)
  values (target_wallet.id, current_user_id, 'pending');

  return query
  select target_wallet.id, target_wallet.name, 'pending'::text;
end;
$$;

-- 4) Any active member may approve / reject requests ----------------------
create or replace function public.approve_join_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.wallet_join_requests%rowtype;
  wallet_deleted_at timestamptz;
begin
  select *
  into request_row
  from public.wallet_join_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Join request not found';
  end if;

  if not public.is_wallet_member(request_row.wallet_id, auth.uid()) then
    raise exception 'Wallet membership required';
  end if;

  select deleted_at into wallet_deleted_at
  from public.wallets
  where id = request_row.wallet_id;

  if wallet_deleted_at is not null then
    raise exception 'Wallet is deleted';
  end if;

  insert into public.wallet_members (wallet_id, user_id, role)
  values (request_row.wallet_id, request_row.user_id, 'member')
  on conflict (wallet_id, user_id) do nothing;

  update public.wallet_join_requests
  set status = 'approved', responded_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.reject_join_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_row public.wallet_join_requests%rowtype;
begin
  select *
  into request_row
  from public.wallet_join_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Join request not found';
  end if;

  if not public.is_wallet_member(request_row.wallet_id, auth.uid()) then
    raise exception 'Wallet membership required';
  end if;

  update public.wallet_join_requests
  set status = 'rejected', responded_at = now()
  where id = p_request_id;
end;
$$;

-- 5) Protect wallet ownership / currencies / invite code ------------------
-- Members may edit presentation fields (name, remark, theme, icon).
-- Only the owner may change deleted_at. Protected identity/currency fields
-- cannot be changed through normal UPDATE calls.
create or replace function public.protect_wallet_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     or new.home_currency is distinct from old.home_currency
     or new.travel_currency is distinct from old.travel_currency
     or new.invite_code is distinct from old.invite_code
     or new.created_at is distinct from old.created_at then
    raise exception 'Protected wallet fields cannot be changed';
  end if;

  if new.deleted_at is distinct from old.deleted_at
     and not public.is_wallet_owner(old.id, auth.uid()) then
    raise exception 'Only the wallet owner can delete or restore the wallet';
  end if;

  return new;
end;
$$;

drop trigger if exists wallets_protect_sensitive_fields on public.wallets;
create trigger wallets_protect_sensitive_fields
before update on public.wallets
for each row execute function public.protect_wallet_sensitive_fields();

-- 6) RLS policy updates ----------------------------------------------------
drop policy if exists "wallets_select_members" on public.wallets;
create policy "wallets_select_members"
on public.wallets
for select
to authenticated
using (
  owner_id = auth.uid()
  or (deleted_at is null and public.is_wallet_member(id))
);

drop policy if exists "wallets_update_owner" on public.wallets;
drop policy if exists "wallets_update_members" on public.wallets;
create policy "wallets_update_members"
on public.wallets
for update
to authenticated
using (
  public.is_wallet_member(id)
  and (deleted_at is null or public.is_wallet_owner(id))
)
with check (
  public.is_wallet_member(id)
  and (deleted_at is null or public.is_wallet_owner(id))
);

drop policy if exists "wallet_members_delete_owner" on public.wallet_members;
drop policy if exists "wallet_members_delete_members" on public.wallet_members;
create policy "wallet_members_delete_members"
on public.wallet_members
for delete
to authenticated
using (
  public.is_wallet_member(wallet_id)
  and role <> 'owner'
);

drop policy if exists "join_requests_select" on public.wallet_join_requests;
create policy "join_requests_select"
on public.wallet_join_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_wallet_member(wallet_id)
);

drop policy if exists "transactions_update_creator_or_owner" on public.transactions;
drop policy if exists "transactions_update_members" on public.transactions;
create policy "transactions_update_members"
on public.transactions
for update
to authenticated
using (public.is_wallet_member(wallet_id))
with check (public.is_wallet_member(wallet_id));

drop policy if exists "transactions_delete_creator_or_owner" on public.transactions;
drop policy if exists "transactions_delete_members" on public.transactions;
create policy "transactions_delete_members"
on public.transactions
for delete
to authenticated
using (public.is_wallet_member(wallet_id));

-- 7) Purge wallets after 14 days ------------------------------------------
-- The V8 client invokes this once per session. It is safe for any authenticated
-- user to trigger because it only deletes wallets whose 14-day retention has
-- already expired.
create or replace function public.purge_expired_wallets()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.wallets
  where deleted_at is not null
    and deleted_at <= now() - interval '14 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_wallets() from public;
grant execute on function public.purge_expired_wallets() to authenticated;

grant execute on function public.request_join_wallet(text) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;
