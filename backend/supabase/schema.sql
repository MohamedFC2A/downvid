-- DOWNVID subscriptions + usage schema (Supabase Postgres)

-- Plans
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_plan') then
    create type public.user_plan as enum ('free', 'ultimate');
  end if;
end $$;

-- Profile / entitlements per user
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.user_plan not null default 'free',
  downloads_used integer not null default 0,
  -- If set, Ultimate is active until this timestamp. If NULL and plan=ultimate, treat as unlimited.
  ultimate_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_plan_idx on public.user_profiles (plan);
create index if not exists user_profiles_ultimate_until_idx on public.user_profiles (ultimate_until);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

-- Minimal RLS: users can read their own profile. Writes should be done by backend (service role).
drop policy if exists "read own profile" on public.user_profiles;
create policy "read own profile"
on public.user_profiles
for select
using (auth.uid() = user_id);

-- Optional: allow creating own row (keeps plan default 'free').
drop policy if exists "insert own profile" on public.user_profiles;
create policy "insert own profile"
on public.user_profiles
for insert
with check (auth.uid() = user_id);

-- Atomic "consume download" RPC (FREE: 5 max; Ultimate: unlimited)
create or replace function public.consume_download(p_user_id uuid)
returns table (
  allowed boolean,
  plan text,
  downloads_used integer,
  downloads_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_plan public.user_plan;
  used integer;
  u_until timestamptz;
begin
  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select user_profiles.plan, user_profiles.downloads_used, user_profiles.ultimate_until
  into current_plan, used, u_until
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if current_plan = 'ultimate' and (u_until is null or u_until > now()) then
    allowed := true;
    plan := current_plan::text;
    downloads_used := used;
    downloads_remaining := -1;
    return next;
    return;
  end if;

  if used < 5 then
    update public.user_profiles
    set downloads_used = downloads_used + 1
    where user_id = p_user_id
    returning public.user_profiles.downloads_used into used;

    allowed := true;
    plan := current_plan::text;
    downloads_used := used;
    downloads_remaining := greatest(0, 5 - used);
  else
    allowed := false;
    plan := current_plan::text;
    downloads_used := used;
    downloads_remaining := 0;
  end if;

  return next;
end $$;

revoke all on function public.consume_download(uuid) from public;
grant execute on function public.consume_download(uuid) to service_role;

-- Promo codes (one-time global usage)
create table if not exists public.promo_codes (
  code text primary key,
  duration_days integer not null default 30,
  active boolean not null default true,
  expires_at timestamptz null,
  redeemed_by uuid null references auth.users(id) on delete set null,
  redeemed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists promo_codes_active_idx on public.promo_codes (active);
create index if not exists promo_codes_redeemed_by_idx on public.promo_codes (redeemed_by);

alter table public.promo_codes enable row level security;

-- Only service_role should manage promo codes; users shouldn't read codes list.
revoke all on table public.promo_codes from anon, authenticated;

-- Redeem promo code: one-time global use, grants 30 days Ultimate (or duration_days)
create or replace function public.redeem_promo_code(p_user_id uuid, p_code text)
returns table (
  success boolean,
  message text,
  plan text,
  ultimate_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  promo record;
  new_until timestamptz;
begin
  if p_code is null or length(trim(p_code)) < 4 then
    success := false;
    message := 'Invalid code';
    plan := 'free';
    ultimate_until := null;
    return next;
    return;
  end if;

  -- Ensure profile exists
  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select *
  into promo
  from public.promo_codes
  where lower(code) = lower(trim(p_code))
  for update;

  if not found then
    success := false;
    message := 'Code not found';
    plan := 'free';
    ultimate_until := null;
    return next;
    return;
  end if;

  if promo.active is not true then
    success := false;
    message := 'Code is inactive';
    plan := 'free';
    ultimate_until := null;
    return next;
    return;
  end if;

  if promo.expires_at is not null and promo.expires_at <= now() then
    success := false;
    message := 'Code expired';
    plan := 'free';
    ultimate_until := null;
    return next;
    return;
  end if;

  if promo.redeemed_at is not null then
    success := false;
    message := 'Code already used';
    plan := 'free';
    ultimate_until := null;
    return next;
    return;
  end if;

  new_until := now() + make_interval(days => greatest(1, promo.duration_days));

  update public.promo_codes
  set redeemed_by = p_user_id,
      redeemed_at = now()
  where code = promo.code;

  update public.user_profiles
  set plan = 'ultimate',
      ultimate_until = greatest(coalesce(public.user_profiles.ultimate_until, now()), new_until)
  where user_id = p_user_id
  returning public.user_profiles.ultimate_until into ultimate_until;

  success := true;
  message := 'Ultimate activated';
  plan := 'ultimate';
  return next;
end $$;

revoke all on function public.redeem_promo_code(uuid, text) from public;
grant execute on function public.redeem_promo_code(uuid, text) to service_role;
