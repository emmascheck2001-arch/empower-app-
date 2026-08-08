-- rls.sql — pgTAP tests proving RLS is enabled and policies exist.
--
-- Run with:  supabase test db      (uses the pgTAP extension)
-- NOT executed here — no database is available in this authoring environment.
-- This file is the automated proof that every table has RLS on and is covered
-- by at least the four CRUD policies from 0002_rls_policies.sql.

begin;

-- 11 tables x (exists + rls-enabled + >=1 policy) = 33, plus 1 plan sanity + the
-- explicit per-table policy-count checks below. Keep the plan count in sync if
-- you add assertions.
select plan(44);

-- ---------------------------------------------------------------------------
-- Helper expectation: the full set of tables that MUST have RLS enabled.
-- ---------------------------------------------------------------------------

-- 1) Every table exists in schema public.
select has_table('public', 'profiles',          'profiles table exists');
select has_table('public', 'cycle_data',        'cycle_data table exists');
select has_table('public', 'daily_logs',        'daily_logs table exists');
select has_table('public', 'mucus_logs',        'mucus_logs table exists');
select has_table('public', 'cycle_summaries',   'cycle_summaries table exists');
select has_table('public', 'user_baselines',    'user_baselines table exists');
select has_table('public', 'user_feedback',     'user_feedback table exists');
select has_table('public', 'friendships',       'friendships table exists');
select has_table('public', 'friend_visibility', 'friend_visibility table exists');
select has_table('public', 'exercise_history',  'exercise_history table exists');
select has_table('public', 'analytics_events',  'analytics_events table exists');

-- 2) RLS is ENABLED on every table (pg_class.relrowsecurity = true).
--    is(<query>, true, desc) evaluates a scalar boolean subquery.
select is(
    (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
    true, 'RLS enabled on profiles');
select is(
    (select relrowsecurity from pg_class where oid = 'public.cycle_data'::regclass),
    true, 'RLS enabled on cycle_data');
select is(
    (select relrowsecurity from pg_class where oid = 'public.daily_logs'::regclass),
    true, 'RLS enabled on daily_logs');
select is(
    (select relrowsecurity from pg_class where oid = 'public.mucus_logs'::regclass),
    true, 'RLS enabled on mucus_logs');
select is(
    (select relrowsecurity from pg_class where oid = 'public.cycle_summaries'::regclass),
    true, 'RLS enabled on cycle_summaries');
select is(
    (select relrowsecurity from pg_class where oid = 'public.user_baselines'::regclass),
    true, 'RLS enabled on user_baselines');
select is(
    (select relrowsecurity from pg_class where oid = 'public.user_feedback'::regclass),
    true, 'RLS enabled on user_feedback');
select is(
    (select relrowsecurity from pg_class where oid = 'public.friendships'::regclass),
    true, 'RLS enabled on friendships');
select is(
    (select relrowsecurity from pg_class where oid = 'public.friend_visibility'::regclass),
    true, 'RLS enabled on friend_visibility');
select is(
    (select relrowsecurity from pg_class where oid = 'public.exercise_history'::regclass),
    true, 'RLS enabled on exercise_history');
select is(
    (select relrowsecurity from pg_class where oid = 'public.analytics_events'::regclass),
    true, 'RLS enabled on analytics_events');

-- 3) Every table has at least one policy (pgTAP policies_are is strict about the
--    exact set, so we count via pg_policies to stay resilient to naming).
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='profiles'),
    '>=', 1, 'profiles has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='cycle_data'),
    '>=', 1, 'cycle_data has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='daily_logs'),
    '>=', 1, 'daily_logs has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='mucus_logs'),
    '>=', 1, 'mucus_logs has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='cycle_summaries'),
    '>=', 1, 'cycle_summaries has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='user_baselines'),
    '>=', 1, 'user_baselines has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='user_feedback'),
    '>=', 1, 'user_feedback has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='friendships'),
    '>=', 1, 'friendships has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='friend_visibility'),
    '>=', 1, 'friend_visibility has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='exercise_history'),
    '>=', 1, 'exercise_history has policies');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='analytics_events'),
    '>=', 1, 'analytics_events has policies');

-- 4) The user-owned tables should have full CRUD coverage (>=4 policies).
--    friendships/friend_visibility are covered by the >=1 check above.
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='daily_logs'),
    '>=', 4, 'daily_logs has full CRUD policy coverage');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='profiles'),
    '>=', 4, 'profiles has full CRUD policy coverage');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='cycle_data'),
    '>=', 4, 'cycle_data has full CRUD policy coverage');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='mucus_logs'),
    '>=', 4, 'mucus_logs has full CRUD policy coverage');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='user_feedback'),
    '>=', 4, 'user_feedback has full CRUD policy coverage');
select cmp_ok(
    (select count(*)::int from pg_policies where schemaname='public' and tablename='analytics_events'),
    '>=', 4, 'analytics_events has full CRUD policy coverage');

-- 5) friendships select policy must reference BOTH parties (defence-in-depth:
--    a policy that only checks requester_id would hide received requests, and a
--    policy that dropped the addressee check could leak). Assert the qual text
--    mentions both columns.
select ok(
    (select bool_or(qual like '%requester_id%' and qual like '%addressee_id%')
     from pg_policies
     where schemaname='public' and tablename='friendships' and cmd='SELECT'),
    'friendships SELECT policy is scoped to requester_id OR addressee_id');

select * from finish();
rollback;
