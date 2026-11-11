-- 0009_prediction_outcomes.sql
-- Preserve the first next-period estimate made in each cycle so timing reliability can be
-- evaluated against the subsequently recorded period start. This is private health data and is
-- owner-only at every layer.

create table if not exists public.cycle_prediction_snapshots (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  cycle_start_date      date not null,
  predicted_period_date date not null,
  window_start          date not null,
  window_end            date not null,
  created_at            timestamptz not null default now(),
  constraint cycle_prediction_snapshots_user_cycle_unique unique (user_id, cycle_start_date),
  constraint cycle_prediction_snapshots_window_order_chk check (window_start <= predicted_period_date and predicted_period_date <= window_end)
);

create index if not exists cycle_prediction_snapshots_user_cycle_idx
  on public.cycle_prediction_snapshots (user_id, cycle_start_date desc);

alter table public.cycle_prediction_snapshots enable row level security;

-- Default grants may include TRUNCATE (which bypasses row-level security).
revoke all on public.cycle_prediction_snapshots from public, anon, authenticated;
grant select, insert, delete on public.cycle_prediction_snapshots to authenticated;

drop policy if exists cycle_prediction_snapshots_select_own on public.cycle_prediction_snapshots;
create policy cycle_prediction_snapshots_select_own on public.cycle_prediction_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists cycle_prediction_snapshots_insert_own on public.cycle_prediction_snapshots;
create policy cycle_prediction_snapshots_insert_own on public.cycle_prediction_snapshots
  for insert with check (auth.uid() = user_id);

-- Snapshots are immutable evidence. No update policy is intentional: a later app visit must not
-- replace the period estimate that is eventually graded.
drop policy if exists cycle_prediction_snapshots_delete_own on public.cycle_prediction_snapshots;
create policy cycle_prediction_snapshots_delete_own on public.cycle_prediction_snapshots
  for delete using (auth.uid() = user_id);

-- Keep account erasure complete when this user-data table is added to the system.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    if uid is null then
        raise exception 'Not authenticated';
    end if;

    delete from public.daily_logs                  where user_id = uid;
    delete from public.mucus_logs                  where user_id = uid;
    delete from public.cycle_data                  where user_id = uid;
    delete from public.cycle_summaries             where user_id = uid;
    delete from public.cycle_prediction_snapshots  where user_id = uid;
    delete from public.user_baselines              where id      = uid;
    delete from public.user_feedback               where user_id = uid;
    delete from public.friendships                 where requester_id = uid or addressee_id = uid;
    delete from public.friend_visibility           where user_id = uid;
    delete from public.analytics_events            where user_id = uid;
    delete from public.exercise_history            where user_id = uid;
    delete from public.profiles                    where id      = uid;
    delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;
