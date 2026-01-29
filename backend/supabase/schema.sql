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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_plan_idx on public.user_profiles (plan);

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
begin
  insert into public.user_profiles (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select user_profiles.plan, user_profiles.downloads_used
  into current_plan, used
  from public.user_profiles
  where user_id = p_user_id
  for update;

  if current_plan = 'ultimate' then
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

