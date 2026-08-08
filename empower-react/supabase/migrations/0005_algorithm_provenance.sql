-- 0005_algorithm_provenance.sql
-- Distinguish user-reported observations from imports and keep learning separated when the
-- user's hormonal context changes. Exercise progression is based on completed performance,
-- never on calendar phase alone.

create unique index if not exists cycle_data_user_id_key on public.cycle_data(user_id);

alter table public.profiles add column if not exists menarche_year integer;
alter table public.profiles drop constraint if exists profiles_menarche_year_chk;
alter table public.profiles add constraint profiles_menarche_year_chk
  check (menarche_year is null or (menarche_year >= 1900 and menarche_year <= 2200));

alter table public.daily_logs add column if not exists workout_imported boolean not null default false;
alter table public.daily_logs add column if not exists workout_feel_reported boolean not null default false;
alter table public.daily_logs add column if not exists hormonal_context text;
alter table public.daily_logs add column if not exists temperature_source text;

alter table public.daily_logs drop constraint if exists daily_logs_hormonal_context_chk;
alter table public.daily_logs add constraint daily_logs_hormonal_context_chk
  check (hormonal_context is null or hormonal_context in (
    'natural-cycle', 'post-contraception', 'contraception-pill',
    'contraception-minipill', 'contraception-patch', 'contraception-ring',
    'contraception-hormonal-iud', 'contraception-implant', 'contraception-depo',
    'contraception-unknown', 'perimenopause', 'postmenopause', 'pregnancy'
  ));

alter table public.daily_logs drop constraint if exists daily_logs_temperature_source_chk;
alter table public.daily_logs add constraint daily_logs_temperature_source_chk
  check (temperature_source is null or temperature_source in ('oral-bbt', 'wearable-wrist', 'other'));

alter table public.exercise_history add column if not exists last_completed boolean not null default false;
alter table public.exercise_history add column if not exists last_session_feel text;
alter table public.exercise_history add column if not exists successful_sessions integer not null default 0;

alter table public.exercise_history drop constraint if exists exercise_history_successful_sessions_chk;
alter table public.exercise_history add constraint exercise_history_successful_sessions_chk
  check (successful_sessions >= 0 and successful_sessions <= 1000);

alter table public.exercise_history drop constraint if exists exercise_history_last_weight_chk;
alter table public.exercise_history add constraint exercise_history_last_weight_chk
  check (last_weight is null or (last_weight > 0 and last_weight <= 500));

-- Friend health fields are opt-in. Enforce visibility inside the SECURITY DEFINER function so
-- hidden dates and observations never reach the client payload.
alter table public.friend_visibility alter column show_phase set default false;
alter table public.friend_visibility alter column show_streak set default false;

drop function if exists public.get_friend_card(uuid);
create function public.get_friend_card(target_user_id uuid)
returns table (
  user_id uuid, name text, user_path text, cycle_length integer, last_period_date date,
  sleep_quality text, workout_feel text, streak integer, show_phase boolean, show_streak boolean,
  show_sleep boolean, show_workout boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = target_user_id)
        or (f.addressee_id = auth.uid() and f.requester_id = target_user_id))
  ) then return; end if;

  return query
  select p.id, p.name,
    case when coalesce(fv.show_phase, false) then p.user_path else null end,
    case when coalesce(fv.show_phase, false) then p.cycle_length else null end,
    case when coalesce(fv.show_phase, false) then cd.last_period_date else null end,
    case when coalesce(fv.show_sleep, false) then dl.sleep_quality else null end,
    case when coalesce(fv.show_workout, false) then dl.workout_feel else null end,
    case when coalesce(fv.show_streak, false) then coalesce(st.streak, 0) else null end,
    coalesce(fv.show_phase, false), coalesce(fv.show_streak, false),
    coalesce(fv.show_sleep, false), coalesce(fv.show_workout, false)
  from public.profiles p
  left join public.friend_visibility fv on fv.user_id = p.id
  left join lateral (
    select c.last_period_date from public.cycle_data c
    where c.user_id = p.id order by c.created_at desc nulls last limit 1
  ) cd on true
  left join lateral (
    select d.sleep_quality, d.workout_feel from public.daily_logs d
    where d.user_id = p.id order by d.log_date desc limit 1
  ) dl on true
  left join lateral (
    select count(*)::integer as streak
    from (
      select d.log_date, row_number() over (order by d.log_date desc) as rn
      from public.daily_logs d
      where d.user_id = p.id and d.log_date <= current_date
      group by d.log_date
    ) consecutive
    where consecutive.log_date = current_date - (consecutive.rn::integer - 1)
  ) st on true
  where p.id = target_user_id;
end;
$$;

revoke execute on function public.get_friend_card(uuid) from anon, public;
grant execute on function public.get_friend_card(uuid) to authenticated;

-- A requester must not be able to accept their own request or rewrite either participant id.
-- Remove direct UPDATE access and expose a narrow addressee-only response function.
revoke update on table public.friendships from authenticated;

create or replace function public.respond_friend_request(friendship_id uuid, accept_request boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  update public.friendships
    set status = case when accept_request then 'accepted' else 'declined' end
    where id = friendship_id
      and addressee_id = auth.uid()
      and status = 'pending';
  return found;
end;
$$;

revoke execute on function public.respond_friend_request(uuid, boolean) from anon, public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
