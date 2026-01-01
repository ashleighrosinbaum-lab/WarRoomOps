-- =========
-- WarRoom Ops: CLEAN RESET for Bundle A
-- This wipes only the WarRoom Ops tables we created/attempted.
-- =========

-- 1) Drop functions first (depend on tables)
drop function if exists public.redeem_invite(text);

-- 2) Drop tables (order matters because of foreign keys)
drop table if exists public.vs_entries cascade;
drop table if exists public.vs_weeks cascade;
drop table if exists public.players cascade;
drop table if exists public.alliance_invites cascade;
drop table if exists public.alliance_members cascade;
drop table if exists public.alliances cascade;

-- 3) Recreate extension (safe)
create extension if not exists "uuid-ossp";

-- 4) Recreate tables (correct schema)
create table public.alliances (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.alliance_members (
  id uuid primary key default uuid_generate_v4(),
  alliance_id uuid not null references public.alliances(id) on delete restrict,
  user_id uuid not null,
  role text not null default 'R3', -- R5, R4, R3, R2, R1
  is_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (alliance_id, user_id)
);

create table public.alliance_invites (
  id uuid primary key default uuid_generate_v4(),
  alliance_id uuid not null references public.alliances(id) on delete restrict,
  code text not null unique,
  created_by uuid not null,
  expires_at timestamptz,
  max_uses int not null default 1,
  uses int not null default 0,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default uuid_generate_v4(),
  alliance_id uuid not null references public.alliances(id) on delete restrict,
  name text not null,
  hq_level int,
  in_game_rank text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (alliance_id, name)
);

create table public.vs_weeks (
  id uuid primary key default uuid_generate_v4(),
  alliance_id uuid not null references public.alliances(id) on delete restrict,
  week_start date not null,
  week_type text not null default 'save', -- 'save' or 'push'
  grace_days int not null default 2,
  locked_at timestamptz,
  lock_reason text,
  created_at timestamptz not null default now(),
  unique (alliance_id, week_start)
);

create table public.vs_entries (
  id uuid primary key default uuid_generate_v4(),
  alliance_id uuid not null references public.alliances(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  game_day date not null,
  score bigint not null,
  notes text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (player_id, game_day)
);

-- 5) Enable RLS
alter table public.alliances enable row level security;
alter table public.alliance_members enable row level security;
alter table public.alliance_invites enable row level security;
alter table public.players enable row level security;
alter table public.vs_weeks enable row level security;
alter table public.vs_entries enable row level security;

-- 6) Policies (clean + valid syntax)

-- alliances: members can view
create policy "alliance members can view alliances"
on public.alliances
for select
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliances.id
      and m.user_id = auth.uid()
      and m.is_disabled = false
  )
);

-- alliances: authenticated can create
create policy "authenticated can create alliance"
on public.alliances
for insert
with check (auth.uid() = created_by);

-- members: members can view members
create policy "members can view alliance members"
on public.alliance_members
for select
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliance_members.alliance_id
      and m.user_id = auth.uid()
      and m.is_disabled = false
  )
);

-- members: R5 can manage members
create policy "R5 can manage members"
on public.alliance_members
for all
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliance_members.alliance_id
      and m.user_id = auth.uid()
      and m.role = 'R5'
      and m.is_disabled = false
  )
)
with check (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliance_members.alliance_id
      and m.user_id = auth.uid()
      and m.role = 'R5'
      and m.is_disabled = false
  )
);

-- invites: R5/R4 manage
create policy "R5R4 can manage invites"
on public.alliance_invites
for all
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliance_invites.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
)
with check (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = alliance_invites.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
);

-- players: members view
create policy "members can view players"
on public.players
for select
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = players.alliance_id
      and m.user_id = auth.uid()
      and m.is_disabled = false
  )
);

-- players: R5/R4 manage
create policy "R5R4 can manage players"
on public.players
for all
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = players.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
)
with check (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = players.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
);

-- vs_weeks: members view
create policy "members can view vs weeks"
on public.vs_weeks
for select
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_weeks.alliance_id
      and m.user_id = auth.uid()
      and m.is_disabled = false
  )
);

-- vs_weeks: R5/R4 manage
create policy "R5R4 can manage vs weeks"
on public.vs_weeks
for all
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_weeks.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
)
with check (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_weeks.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
);

-- vs_entries: members view
create policy "members can view vs entries"
on public.vs_entries
for select
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_entries.alliance_id
      and m.user_id = auth.uid()
      and m.is_disabled = false
  )
);

-- vs_entries: R5/R4 manage
create policy "R5R4 can manage vs entries"
on public.vs_entries
for all
using (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_entries.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
)
with check (
  exists (
    select 1 from public.alliance_members m
    where m.alliance_id = vs_entries.alliance_id
      and m.user_id = auth.uid()
      and m.role in ('R5','R4')
      and m.is_disabled = false
  )
);

-- 7) RPC: redeem invite (join alliance)
create function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_inv public.alliance_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_inv
  from public.alliance_invites
  where code = p_code
  limit 1;

  if not found then raise exception 'invalid code'; end if;
  if v_inv.is_revoked then raise exception 'code revoked'; end if;
  if v_inv.expires_at is not null and now() > v_inv.expires_at then raise exception 'code expired'; end if;
  if v_inv.uses >= v_inv.max_uses then raise exception 'code already used'; end if;

  update public.alliance_invites
  set uses = uses + 1
  where id = v_inv.id;

  insert into public.alliance_members (alliance_id, user_id, role)
  values (v_inv.alliance_id, auth.uid(), 'R3')
  on conflict (alliance_id, user_id) do update
    set is_disabled = false;

  return v_inv.alliance_id;
end;
$$;

revoke all on function public.redeem_invite(text) from public;
grant execute on function public.redeem_invite(text) to authenticated;
