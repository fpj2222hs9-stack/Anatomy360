-- Imhotep: per-student progress sync (Google sign-in via Supabase Auth).
-- Applied to project "Anatomy-360" (uaxreejcuantlwtuadtv) as migrations "imhotep_progress_sync" (+ "imhotep_backups_keep_2", "imhotep_delete_my_account") on 2026-11-12/13.
-- Safe to re-run: everything is "if not exists" / "or replace" / "drop policy if exists".
--
-- Model: ONE row per student (user_id = auth.users.id) holding the whole progress JSON in `data`.
--   rev        optimistic-concurrency counter. The client PATCHes with ?rev=eq.<N> and sends N+1;
--              the trigger forces rev = old.rev + 1 anyway, so a client can never skip or rewind it.
--   progress_backups  safety copies of the OLD row kept by the trigger (clients can read their own, never write).
-- Security: RLS ON, a student can only see / create / update their own row; nobody can delete (no delete policy);
--           `anon` has no access at all. The anon/publishable key in js/cloud-config.js is therefore safe to be public.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null,
  rev        integer not null default 1 check (rev >= 1),
  device     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress_backups (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  data      jsonb not null,
  rev       integer not null,
  reason    text not null check (reason in ('periodic','shrink')),
  taken_at  timestamptz not null default now()
);
create index if not exists progress_backups_user_idx on public.progress_backups (user_id, reason, taken_at desc);

alter table public.progress         enable row level security;
alter table public.progress_backups enable row level security;

revoke all on public.progress         from anon, authenticated;
revoke all on public.progress_backups from anon, authenticated;
grant select, insert, update on public.progress         to authenticated;
grant select                 on public.progress_backups to authenticated;

drop policy if exists progress_select_own on public.progress;
drop policy if exists progress_insert_own on public.progress;
drop policy if exists progress_update_own on public.progress;
create policy progress_select_own on public.progress for select to authenticated
  using ((select auth.uid()) = user_id);
create policy progress_insert_own on public.progress for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy progress_update_own on public.progress for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists progress_backups_select_own on public.progress_backups;
create policy progress_backups_select_own on public.progress_backups for select to authenticated
  using ((select auth.uid()) = user_id);

-- Guard + backup trigger.
--   * data must be a JSON object, at most ~4 MB.
--   * rev / updated_at / created_at are server-controlled.
--   * On UPDATE the previous data is copied to progress_backups when:
--       - 'periodic': the last periodic backup is older than 24 h (keeps the newest 2), or
--       - 'shrink'  : the number of answers drops by more than 30% (and more than 20) in one write, i.e. a wiped device
--                     overwrote the account (keeps the newest 2).
create or replace function public.progress_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_n int := 0; new_n int := 0; last_bk timestamptz;
begin
  if jsonb_typeof(new.data) is distinct from 'object' then
    raise exception 'progress.data must be a JSON object' using errcode = '22023';
  end if;
  if octet_length(new.data::text) > 4000000 then
    raise exception 'progress.data too large' using errcode = '54000';
  end if;

  if tg_op = 'INSERT' then
    new.rev := 1; new.created_at := now(); new.updated_at := now();
    return new;
  end if;

  new.user_id := old.user_id; new.created_at := old.created_at;
  new.rev := old.rev + 1;     new.updated_at := now();

  if jsonb_typeof(old.data->'ans') = 'object' then select count(*) into old_n from jsonb_object_keys(old.data->'ans'); end if;
  if jsonb_typeof(new.data->'ans') = 'object' then select count(*) into new_n from jsonb_object_keys(new.data->'ans'); end if;

  if old_n - new_n > 20 and new_n < old_n * 0.7 then
    insert into public.progress_backups(user_id, data, rev, reason) values (old.user_id, old.data, old.rev, 'shrink');
    delete from public.progress_backups where user_id = old.user_id and reason = 'shrink'
      and id not in (select id from public.progress_backups where user_id = old.user_id and reason = 'shrink' order by taken_at desc, id desc limit 2);
  end if;

  select max(taken_at) into last_bk from public.progress_backups where user_id = old.user_id and reason = 'periodic';
  if last_bk is null or last_bk < now() - interval '24 hours' then
    insert into public.progress_backups(user_id, data, rev, reason) values (old.user_id, old.data, old.rev, 'periodic');
    delete from public.progress_backups where user_id = old.user_id and reason = 'periodic'
      and id not in (select id from public.progress_backups where user_id = old.user_id and reason = 'periodic' order by taken_at desc, id desc limit 2);
  end if;
  return new;
end $$;

revoke all on function public.progress_guard() from public, anon, authenticated;

drop trigger if exists progress_guard_trg on public.progress;
create trigger progress_guard_trg before insert or update on public.progress
  for each row execute function public.progress_guard();

-- Self-service account deletion (privacy policy promise). A signed-in student calls
--   POST /rest/v1/rpc/delete_my_account   (Authorization: Bearer <their JWT>)
-- It deletes THEIR auth user; the foreign keys cascade to progress and progress_backups.
-- Applied as migration "imhotep_delete_my_account".
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
