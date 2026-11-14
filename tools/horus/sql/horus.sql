-- Imhotep · Horus live chat backend (Supabase). Safe to re-run: everything is "if not exists" / "or replace".
-- Tables: horus_passages (the books, PRIVATE), horus_cache (shared answers), horus_usage (daily counters), horus_chat (each student's own history).
-- The Edge Function "horus" uses the project's secret key (injected by Supabase, never in a file) to read/write the first three.
-- Students (role authenticated) can only touch THEIR row of horus_chat. anon can touch nothing.

-- ---------------------------------------------------------------- the books
create table if not exists public.horus_passages (
  id      bigint generated always as identity primary key,
  sid     text not null check (sid in ('anatomy','histology','physiology','biochemistry')),
  src     text not null,                       -- source id, e.g. anatomy-dept-book
  ord     integer not null default 0,          -- source priority inside the subject (0 = department book first)
  seq     integer not null default 0,          -- order inside the source (the neighbouring section is used as context)
  book    text not null,
  chapter text not null default '',
  heading text not null default '',
  page    text not null default '',
  body    text not null
);
create index if not exists horus_passages_sid_idx on public.horus_passages (sid, ord, seq);

-- ---------------------------------------------------------------- shared answers (cache)
create table if not exists public.horus_cache (
  key        text primary key,
  kind       text not null check (kind in ('chat','q')),
  sid        text not null default 'all',
  q          text not null default '',
  ans        jsonb not null,
  hits       integer not null default 0,
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  constraint horus_cache_size check (octet_length(ans::text) <= 20000)
);

-- ---------------------------------------------------------------- daily counters (per student 'u:<uuid>', Gemini calls 'g')
create table if not exists public.horus_usage (
  scope text not null,
  day   date not null,
  n     integer not null default 0,
  primary key (scope, day)
);

-- ---------------------------------------------------------------- each student's chat history (their own row, via RLS)
create table if not exists public.horus_chat (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  msgs       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.horus_passages enable row level security;
alter table public.horus_cache    enable row level security;
alter table public.horus_usage    enable row level security;
alter table public.horus_chat     enable row level security;

revoke all on public.horus_passages from anon, authenticated;
revoke all on public.horus_cache    from anon, authenticated;
revoke all on public.horus_usage    from anon, authenticated;
revoke all on public.horus_chat     from anon, authenticated;
grant all on public.horus_passages, public.horus_cache, public.horus_usage, public.horus_chat to service_role;
grant usage, select on sequence public.horus_passages_id_seq to service_role;
grant select, insert, update on public.horus_chat to authenticated;

drop policy if exists horus_chat_select_own on public.horus_chat;
drop policy if exists horus_chat_insert_own on public.horus_chat;
drop policy if exists horus_chat_update_own on public.horus_chat;
create policy horus_chat_select_own on public.horus_chat for select to authenticated using ((select auth.uid()) = user_id);
create policy horus_chat_insert_own on public.horus_chat for insert to authenticated with check ((select auth.uid()) = user_id);
create policy horus_chat_update_own on public.horus_chat for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.horus_chat_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(new.msgs) is distinct from 'array' then
    raise exception 'horus_chat.msgs must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(new.msgs) > 200 or octet_length(new.msgs::text) > 400000 then
    raise exception 'horus_chat.msgs too large' using errcode = '54000';
  end if;
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.horus_chat_guard() from public, anon, authenticated;
drop trigger if exists horus_chat_guard_trg on public.horus_chat;
create trigger horus_chat_guard_trg before insert or update on public.horus_chat
  for each row execute function public.horus_chat_guard();

-- ---------------------------------------------------------------- server-side helpers (only the Edge Function may call them)
-- one "ask" or one Gemini call: returns the new count, or -1 when the limit is already reached (nothing is counted then)
create or replace function public.horus_take(p_scope text, p_day date, p_limit integer) returns integer
language plpgsql security definer set search_path = '' as $$
declare v integer;
begin
  if p_limit < 1 then return -1; end if;
  insert into public.horus_usage as u (scope, day, n) values (p_scope, p_day, 1)
    on conflict (scope, day) do update set n = u.n + 1 where u.n < p_limit
    returning u.n into v;
  if v is null then return -1; end if;
  if random() < 0.02 then delete from public.horus_usage where day < p_day - 7; end if;
  return v;
end $$;

create or replace function public.horus_give_back(p_scope text, p_day date) returns void
language sql security definer set search_path = '' as $$
  update public.horus_usage set n = greatest(n - 1, 0) where scope = p_scope and day = p_day;
$$;

create or replace function public.horus_peek(p_scope text, p_day date) returns integer
language sql security definer set search_path = '' stable as $$
  select coalesce((select n from public.horus_usage where scope = p_scope and day = p_day), 0);
$$;

create or replace function public.horus_cache_get(p_key text) returns jsonb
language sql security definer set search_path = '' as $$
  update public.horus_cache set hits = hits + 1, last_at = now() where key = p_key returning ans;
$$;

create or replace function public.horus_cache_put(p_key text, p_kind text, p_sid text, p_q text, p_ans jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.horus_cache (key, kind, sid, q, ans) values (p_key, p_kind, p_sid, left(p_q, 400), p_ans)
    on conflict (key) do update set ans = excluded.ans, q = excluded.q, last_at = now();
  if random() < 0.01 and (select count(*) from public.horus_cache) > 20000 then
    delete from public.horus_cache where key in (select key from public.horus_cache order by last_at asc limit 1000);
  end if;
end $$;

revoke all on function public.horus_take(text, date, integer)                        from public, anon, authenticated;
revoke all on function public.horus_give_back(text, date)                            from public, anon, authenticated;
revoke all on function public.horus_peek(text, date)                                 from public, anon, authenticated;
revoke all on function public.horus_cache_get(text)                                  from public, anon, authenticated;
revoke all on function public.horus_cache_put(text, text, text, text, jsonb)         from public, anon, authenticated;
grant execute on function public.horus_take(text, date, integer)                     to service_role;
grant execute on function public.horus_give_back(text, date)                         to service_role;
grant execute on function public.horus_peek(text, date)                              to service_role;
grant execute on function public.horus_cache_get(text)                               to service_role;
grant execute on function public.horus_cache_put(text, text, text, text, jsonb)      to service_role;

-- ---------------------------------------------------------------- account deletion also removes the counters (the chat row cascades by itself)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from public.horus_usage where scope = 'u:' || auth.uid()::text;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
