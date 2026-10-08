-- Banda World Islands: game data in the LearnKyrgyz / The4Workspace Supabase project.
-- Accounts are The4Workspace accounts (auth.users + public.profiles.role).

create table if not exists public.banda_players (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 24),
  avatar      jsonb not null default '{}'::jsonb,
  stars       int  not null default 0 check (stars >= 0),
  points      int  not null default 0 check (points >= 0),
  award_day   date,
  award_today int  not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.banda_players enable row level security;
create policy banda_players_read on public.banda_players for select to authenticated using (true);
create policy banda_players_insert on public.banda_players for insert to authenticated with check (id = (select auth.uid()));
create policy banda_players_update on public.banda_players for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Players may only set their name and avatar; stars and points change through the functions below.
revoke all on public.banda_players from anon, authenticated;
grant select on public.banda_players to authenticated;
grant insert (id, name, avatar) on public.banda_players to authenticated;
grant update (name, avatar, updated_at) on public.banda_players to authenticated;

-- Teacher commands (announcements, admin abuse, giveaways, minigames, music). Only teachers can insert.
create table if not exists public.banda_commands (
  id         bigserial primary key,
  server     text not null check (char_length(server) <= 32),
  kind       text not null check (char_length(kind) <= 32),
  data       jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists banda_commands_server_idx on public.banda_commands (server, created_at desc);
alter table public.banda_commands enable row level security;

create or replace function public.banda_is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher');
$$;

create policy banda_commands_read on public.banda_commands for select to authenticated using (true);
create policy banda_commands_insert on public.banda_commands for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.banda_is_teacher()));
revoke all on public.banda_commands from anon, authenticated;
grant select, insert on public.banda_commands to authenticated;
grant usage on sequence public.banda_commands_id_seq to authenticated;

create table if not exists public.banda_claims (
  cmd_id  bigint not null references public.banda_commands(id) on delete cascade,
  user_id uuid   not null references auth.users(id) on delete cascade,
  primary key (cmd_id, user_id)
);
alter table public.banda_claims enable row level security;
revoke all on public.banda_claims from anon, authenticated;

-- A player earns stars from games (max 10 at once, 300 per day).
create or replace function public.banda_award(n int) returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.banda_players;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if n is null or n < 1 or n > 10 then raise exception 'bad amount'; end if;
  insert into public.banda_players (id) values (uid) on conflict (id) do nothing;
  select * into r from public.banda_players where id = uid for update;
  if r.award_day is distinct from current_date then r.award_today := 0; end if;
  n := least(n, greatest(0, 300 - r.award_today));
  update public.banda_players set stars = stars + n, award_today = r.award_today + n, award_day = current_date, updated_at = now()
    where id = uid returning stars into r.stars;
  return r.stars;
end $$;

-- A teacher gives or takes stars / house points.
create or replace function public.banda_give(target uuid, d_stars int, d_points int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.banda_is_teacher() then raise exception 'teachers only'; end if;
  if abs(coalesce(d_stars, 0)) > 100 or abs(coalesce(d_points, 0)) > 10 then raise exception 'bad amount'; end if;
  insert into public.banda_players (id) values (target) on conflict (id) do nothing;
  update public.banda_players set stars = greatest(0, stars + coalesce(d_stars, 0)), points = greatest(0, points + coalesce(d_points, 0)), updated_at = now()
    where id = target;
end $$;

-- A player claims a teacher's giveaway once, within 3 minutes of it.
create or replace function public.banda_claim(cmd bigint) returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c public.banda_commands; n int; got int;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into c from public.banda_commands where id = cmd and kind = 'giveaway' and created_at > now() - interval '3 minutes';
  if not found then return 0; end if;
  insert into public.banda_claims (cmd_id, user_id) values (cmd, uid) on conflict do nothing;
  get diagnostics got = row_count;
  if got = 0 then return 0; end if;
  n := least(greatest(coalesce((c.data->>'n')::int, 0), 0), 30);
  insert into public.banda_players (id) values (uid) on conflict (id) do nothing;
  update public.banda_players set stars = stars + n, updated_at = now() where id = uid;
  return n;
end $$;

revoke execute on function public.banda_is_teacher(), public.banda_award(int), public.banda_give(uuid, int, int), public.banda_claim(bigint) from public, anon;
grant execute on function public.banda_is_teacher(), public.banda_award(int), public.banda_give(uuid, int, int), public.banda_claim(bigint) to authenticated;

alter publication supabase_realtime add table public.banda_commands;
