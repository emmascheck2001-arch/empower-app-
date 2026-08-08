-- 0003_functions.sql
-- Em~power — SECURITY DEFINER functions and their EXECUTE grants.
--
-- Encodes the permanent security rules from CLAUDE.md
-- ("Database security — friend functions" + "delete_my_account()"):
--
--   * Every function here is SECURITY DEFINER (it bypasses RLS) and therefore
--     RE-IMPLEMENTS its own auth.uid() access check. A June 2026 audit found the
--     friend functions had NO internal guard and leaked every user's data to any
--     caller with an email. That must never regress.
--   * Every function pins `set search_path = public` (prevents search-path
--     hijacking of unqualified names inside a definer context).
--   * EXECUTE is REVOKEd from anon and PUBLIC, then GRANTed only to authenticated.
--
-- Authored without a live database. `create or replace function` makes this
-- re-runnable; the REVOKE/GRANT block is idempotent.
--
-- NOTE ON RETURN SHAPES: the exact column list of the friend "phase card" is a
-- product/UI concern that lives in the app. The bodies below return the columns
-- the dashboard/Friends card consumes (name, user_path, cycle_length,
-- last_period_date, and the visibility-gated sleep/workout/streak signals). If
-- the live function returns a different set, adjust the RETURNS TABLE list — the
-- SECURITY-critical parts (SECURITY DEFINER, search_path, the friendship guard,
-- the grants) are what these migrations and the pgTAP tests pin down.

-- =============================================================================
-- get_friend_card(target_user_id uuid)
-- Returns a friend's phase card ONLY when an `accepted` friendships row exists
-- between auth.uid() and target_user_id in EITHER direction. Otherwise returns
-- no rows. Respects the target's friend_visibility flags.
-- =============================================================================
create or replace function public.get_friend_card(target_user_id uuid)
returns table (
    user_id          uuid,
    name             text,
    user_path        text,
    cycle_length     integer,
    last_period_date date,
    sleep_quality    text,
    workout_feel     text,
    streak           integer,
    show_phase       boolean,
    show_streak      boolean,
    show_sleep       boolean,
    show_workout     boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
    -- CRITICAL GUARD (never remove): a SECURITY DEFINER function bypasses RLS,
    -- so it must prove the caller is allowed to see this data. Require a logged-in
    -- caller AND an ACCEPTED friendship in either direction.
    if auth.uid() is null then
        return;  -- not logged in: return no rows
    end if;

    if not exists (
        select 1
        from public.friendships f
        where f.status = 'accepted'
          and (
                (f.requester_id = auth.uid() and f.addressee_id = target_user_id)
             or (f.addressee_id = auth.uid() and f.requester_id = target_user_id)
              )
    ) then
        return;  -- no accepted friendship: return no rows (do NOT leak data)
    end if;

    return query
    select
        p.id as user_id,
        p.name,
        case when coalesce(fv.show_phase, false) then p.user_path else null end,
        case when coalesce(fv.show_phase, false) then p.cycle_length else null end,
        case when coalesce(fv.show_phase, false) then cd.last_period_date else null end,
        case when coalesce(fv.show_sleep, false) then dl.sleep_quality else null end,
        case when coalesce(fv.show_workout, false) then dl.workout_feel else null end,
        case when coalesce(fv.show_streak, false) then coalesce(st.streak, 0) else null end,
        coalesce(fv.show_phase,   false) as show_phase,
        coalesce(fv.show_streak,  false) as show_streak,
        coalesce(fv.show_sleep,   false) as show_sleep,
        coalesce(fv.show_workout, false) as show_workout
    from public.profiles p
    left join public.friend_visibility fv on fv.user_id = p.id
    left join lateral (
        select c.last_period_date
        from public.cycle_data c
        where c.user_id = p.id
        order by c.created_at desc nulls last
        limit 1
    ) cd on true
    left join lateral (
        select d.sleep_quality, d.workout_feel
        from public.daily_logs d
        where d.user_id = p.id
        order by d.log_date desc
        limit 1
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

-- =============================================================================
-- find_user_by_email(search_email text)
-- Returns a user's UUID for the add-friend-by-email flow. Authenticated-only:
-- with EXECUTE revoked from anon/public this is not an unauthenticated email
-- enumeration oracle. Also self-guards on auth.uid() being present.
-- =============================================================================
create or replace function public.find_user_by_email(search_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    found_id uuid;
begin
    -- CRITICAL GUARD (never remove): require a logged-in caller. Combined with
    -- EXECUTE being revoked from anon/public, this keeps the function from
    -- becoming an email-enumeration oracle.
    if auth.uid() is null then
        return null;
    end if;

    select p.id
    into found_id
    from public.profiles p
    where lower(p.email) = lower(trim(search_email))
    limit 1;

    return found_id;
end;
$$;

-- =============================================================================
-- delete_my_account()
-- Deletes ALL of the caller's data from EVERY user-data table, then the caller's
-- auth.users row. Every delete is gated to auth.uid() so a user can only ever
-- erase THEIR OWN account.
--
-- PERMANENT RULE: if a NEW user-data table is ever added, add its delete here so
-- erasure stays complete.
-- =============================================================================
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
begin
    -- CRITICAL GUARD (never remove): must be logged in; only ever deletes self.
    if uid is null then
        raise exception 'Not authenticated';
    end if;

    delete from public.daily_logs       where user_id = uid;
    delete from public.mucus_logs       where user_id = uid;
    delete from public.cycle_data       where user_id = uid;
    delete from public.cycle_summaries  where user_id = uid;
    delete from public.user_baselines   where id      = uid;  -- keyed by id, not user_id
    delete from public.user_feedback    where user_id = uid;
    delete from public.friendships      where requester_id = uid or addressee_id = uid;
    delete from public.friend_visibility where user_id = uid;
    delete from public.analytics_events where user_id = uid;
    delete from public.exercise_history where user_id = uid;
    delete from public.profiles         where id      = uid;

    -- Finally remove the auth identity itself.
    delete from auth.users where id = uid;
end;
$$;

-- =============================================================================
-- EXECUTE grants — REVOKE from anon/public, GRANT only to authenticated.
-- Order matters: revoke first, then grant. This block is idempotent.
-- =============================================================================
revoke execute on function public.get_friend_card(uuid)    from anon, public;
revoke execute on function public.find_user_by_email(text) from anon, public;
revoke execute on function public.delete_my_account()      from anon, public;

grant execute on function public.get_friend_card(uuid)     to authenticated;
grant execute on function public.find_user_by_email(text)  to authenticated;
grant execute on function public.delete_my_account()       to authenticated;

-- NOTE: get_all_feedback() and get_claude_instructions() also exist in the live
-- DB (per CLAUDE.md). get_all_feedback stays callable by `authenticated` but
-- self-checks Emma's uid internally (the one expected/safe advisor WARN);
-- get_claude_instructions has a pinned search_path = public. They are not
-- reconstructed here because their bodies (the hardcoded advisor uid, the
-- instruction text) are not derivable from the app source without the live
-- definitions. When their real definitions are captured, add them to this file
-- and, for get_all_feedback, ADD a pgTAP privilege test asserting anon has no
-- EXECUTE and that the internal uid self-check is present.
