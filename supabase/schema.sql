-- =========================================================
-- Travel Wallet - Canonical Supabase Schema v1
-- Fresh-project setup only.
--
-- IMPORTANT:
-- This file is the clean consolidated schema for a NEW Supabase project.
-- Do not run the full file against the existing live project, because the
-- tables/policies/functions already exist there.
-- =========================================================

-- ---------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. WALLETS
-- ---------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  remark text check (remark is null or char_length(remark) <= 100),
  home_currency text not null check (home_currency ~ '^[A-Z]{3}$'),
  travel_currency text not null check (travel_currency ~ '^[A-Z]{3}$'),
  invite_code text unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  theme text not null default '#0F7775',
  icon text not null default '🧳',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 3. WALLET MEMBERS
-- ---------------------------------------------------------
create table public.wallet_members (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (wallet_id, user_id)
);

-- ---------------------------------------------------------
-- 4. WALLET JOIN REQUESTS
-- ---------------------------------------------------------
create table public.wallet_join_requests (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index wallet_join_requests_pending_unique
on public.wallet_join_requests(wallet_id, user_id)
where status = 'pending';

-- ---------------------------------------------------------
-- 5. TRANSACTIONS
-- ---------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  type text not null check (type in ('expense', 'topup')),
  note text check (note is null or char_length(note) <= 120),
  foreign_amount numeric(20,6) not null check (foreign_amount > 0),
  home_amount numeric(20,6) not null check (home_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------
create index wallets_owner_id_idx on public.wallets(owner_id);
create index wallets_invite_code_idx on public.wallets(invite_code);
create index wallet_members_user_id_idx on public.wallet_members(user_id);
create index wallet_join_requests_wallet_id_idx on public.wallet_join_requests(wallet_id);
create index wallet_join_requests_user_id_idx on public.wallet_join_requests(user_id);
create index transactions_wallet_id_created_at_idx on public.transactions(wallet_id, created_at desc);
create index transactions_user_id_idx on public.transactions(user_id);

-- =========================================================
-- COMMON FUNCTIONS / TRIGGERS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger wallets_set_updated_at
before update on public.wallets
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Invite code generator
-- ---------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i integer;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(
        chars,
        floor(random() * length(chars))::integer + 1,
        1
      );
    end loop;

    exit when not exists (
      select 1 from public.wallets where invite_code = result
    );
  end loop;

  return result;
end;
$$;

alter table public.wallets
alter column invite_code set default public.generate_invite_code();

alter table public.wallets
alter column invite_code set not null;

-- ---------------------------------------------------------
-- Create profile automatically for new Auth user
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- Add wallet creator to wallet_members as owner
-- ---------------------------------------------------------
create or replace function public.handle_new_wallet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wallet_members (wallet_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  return new;
end;
$$;

create trigger on_wallet_created
after insert on public.wallets
for each row execute function public.handle_new_wallet();

-- =========================================================
-- SECURITY HELPERS
-- =========================================================

create or replace function public.is_wallet_member(
  p_wallet_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wallet_members
    where wallet_id = p_wallet_id
      and user_id = p_user_id
  );
$$;

create or replace function public.is_wallet_owner(
  p_wallet_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wallets
    where id = p_wallet_id
      and owner_id = p_user_id
  );
$$;

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
      join public.wallets wallet
        on wallet.id = request.wallet_id
      where request.user_id = p_profile_id
        and request.status = 'pending'
        and wallet.owner_id = auth.uid()
    );
$$;

-- =========================================================
-- JOIN WALLET RPCS
-- =========================================================

-- Corrected production version: all potentially ambiguous column references
-- are qualified with aliases.
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
begin
  select *
  into request_row
  from public.wallet_join_requests
  where id = p_request_id
    and status = 'pending';

  if not found then
    raise exception 'Join request not found';
  end if;

  if not public.is_wallet_owner(request_row.wallet_id, auth.uid()) then
    raise exception 'Only the wallet owner can approve requests';
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

  if not public.is_wallet_owner(request_row.wallet_id, auth.uid()) then
    raise exception 'Only the wallet owner can reject requests';
  end if;

  update public.wallet_join_requests
  set status = 'rejected', responded_at = now()
  where id = p_request_id;
end;
$$;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_members enable row level security;
alter table public.wallet_join_requests enable row level security;
alter table public.transactions enable row level security;

-- PROFILES
create policy "profiles_select_allowed"
on public.profiles
for select
to authenticated
using (public.can_view_profile(id));

create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- WALLETS
-- Corrected production policy: the owner can read the row immediately after
-- INSERT, even before wallet_members is observed by the client SELECT.
create policy "wallets_select_members"
on public.wallets
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_wallet_member(id)
);

create policy "wallets_insert_owner"
on public.wallets
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "wallets_update_owner"
on public.wallets
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "wallets_delete_owner"
on public.wallets
for delete
to authenticated
using (owner_id = auth.uid());

-- WALLET MEMBERS
create policy "wallet_members_select_members"
on public.wallet_members
for select
to authenticated
using (public.is_wallet_member(wallet_id));

create policy "wallet_members_delete_owner"
on public.wallet_members
for delete
to authenticated
using (
  public.is_wallet_owner(wallet_id)
  and role <> 'owner'
);

-- JOIN REQUESTS
create policy "join_requests_select"
on public.wallet_join_requests
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_wallet_owner(wallet_id)
);

-- TRANSACTIONS
create policy "transactions_select_members"
on public.transactions
for select
to authenticated
using (public.is_wallet_member(wallet_id));

create policy "transactions_insert_members"
on public.transactions
for insert
to authenticated
with check (
  public.is_wallet_member(wallet_id)
  and user_id = auth.uid()
);

create policy "transactions_update_creator_or_owner"
on public.transactions
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_wallet_owner(wallet_id)
)
with check (public.is_wallet_member(wallet_id));

create policy "transactions_delete_creator_or_owner"
on public.transactions
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_wallet_owner(wallet_id)
);

-- =========================================================
-- API PRIVILEGES
-- =========================================================

revoke all on public.profiles from anon;
revoke all on public.wallets from anon;
revoke all on public.wallet_members from anon;
revoke all on public.wallet_join_requests from anon;
revoke all on public.transactions from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.wallets to authenticated;
grant select, delete on public.wallet_members to authenticated;
grant select on public.wallet_join_requests to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;

revoke all on function public.request_join_wallet(text) from public;
revoke all on function public.approve_join_request(uuid) from public;
revoke all on function public.reject_join_request(uuid) from public;

grant execute on function public.request_join_wallet(text) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.reject_join_request(uuid) to authenticated;

-- =========================================================
-- REALTIME PUBLICATION
-- =========================================================
-- Safe for a fresh project. The guards avoid duplicate-publication errors.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wallets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wallet_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_members;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wallet_join_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_join_requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
