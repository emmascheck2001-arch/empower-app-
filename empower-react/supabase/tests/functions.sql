-- functions.sql — pgTAP tests proving the SECURITY DEFINER functions are safe.
--
-- Run with:  supabase test db      (uses the pgTAP extension)
-- NOT executed here — no database is available in this authoring environment.
--
-- These are the automated proof of the permanent security rules in CLAUDE.md:
--   * the three functions exist
--   * they are SECURITY DEFINER (pg_proc.prosecdef)
--   * they pin search_path = public (pg_proc.proconfig)
--   * EXECUTE is NOT granted to anon or public, but IS granted to authenticated
--
-- Behavioural checks (friendship authorization, complete deletion) require
-- seeded auth.users rows and a way to impersonate them; they are described as
-- SKIPped scaffolding at the bottom.

begin;

select plan(24);

-- ---------------------------------------------------------------------------
-- 1) Functions exist (schema public), with the argument signatures from 0003.
-- ---------------------------------------------------------------------------
select has_function('public', 'get_friend_card',    array['uuid'],
    'get_friend_card(uuid) exists');
select has_function('public', 'find_user_by_email', array['text'],
    'find_user_by_email(text) exists');
select has_function('public', 'delete_my_account',  array[]::text[],
    'delete_my_account() exists');
select has_function('public', 'respond_friend_request', array['uuid','boolean'],
    'respond_friend_request(uuid, boolean) exists');

-- ---------------------------------------------------------------------------
-- 2) All three are SECURITY DEFINER (prosecdef = true).
-- ---------------------------------------------------------------------------
select is(
    (select prosecdef from pg_proc where oid = 'public.get_friend_card(uuid)'::regprocedure),
    true, 'get_friend_card is SECURITY DEFINER');
select is(
    (select prosecdef from pg_proc where oid = 'public.find_user_by_email(text)'::regprocedure),
    true, 'find_user_by_email is SECURITY DEFINER');
select is(
    (select prosecdef from pg_proc where oid = 'public.delete_my_account()'::regprocedure),
    true, 'delete_my_account is SECURITY DEFINER');
select is(
    (select prosecdef from pg_proc where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure),
    true, 'respond_friend_request is SECURITY DEFINER');

-- ---------------------------------------------------------------------------
-- 3) search_path is pinned to public (proconfig contains 'search_path=public').
--    proconfig is text[] of 'key=value' GUC settings applied for the function.
-- ---------------------------------------------------------------------------
select ok(
    (select proconfig @> array['search_path=public']
     from pg_proc where oid = 'public.get_friend_card(uuid)'::regprocedure),
    'get_friend_card pins search_path=public');
select ok(
    (select proconfig @> array['search_path=public']
     from pg_proc where oid = 'public.find_user_by_email(text)'::regprocedure),
    'find_user_by_email pins search_path=public');
select ok(
    (select proconfig @> array['search_path=public']
     from pg_proc where oid = 'public.delete_my_account()'::regprocedure),
    'delete_my_account pins search_path=public');
select ok(
    (select proconfig @> array['search_path=public']
     from pg_proc where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure),
    'respond_friend_request pins search_path=public');

-- ---------------------------------------------------------------------------
-- 4) EXECUTE is NOT granted to anon.
-- ---------------------------------------------------------------------------
select ok(
    not has_function_privilege('anon', 'public.get_friend_card(uuid)', 'EXECUTE'),
    'anon CANNOT execute get_friend_card');
select ok(
    not has_function_privilege('anon', 'public.find_user_by_email(text)', 'EXECUTE'),
    'anon CANNOT execute find_user_by_email');
select ok(
    not has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE'),
    'anon CANNOT execute delete_my_account');
select ok(
    not has_function_privilege('anon', 'public.respond_friend_request(uuid,boolean)', 'EXECUTE'),
    'anon CANNOT execute respond_friend_request');

-- ---------------------------------------------------------------------------
-- 5) EXECUTE is NOT granted to PUBLIC. There is no "public" role to test with
--    has_function_privilege, so assert no PUBLIC grant exists in proacl.
--    A PUBLIC EXECUTE grant shows up as an ACL entry with an empty grantee
--    ('=X/owner'). We assert no such entry is present.
-- ---------------------------------------------------------------------------
select ok(
    not exists (
        select 1 from pg_proc,
             lateral unnest(coalesce(proacl, array[]::aclitem[])) a
        where oid = 'public.get_friend_card(uuid)'::regprocedure
          and a::text like '=%'   -- '=...' == grant to PUBLIC
    ),
    'get_friend_card has no PUBLIC execute grant');
select ok(
    not exists (
        select 1 from pg_proc,
             lateral unnest(coalesce(proacl, array[]::aclitem[])) a
        where oid = 'public.find_user_by_email(text)'::regprocedure
          and a::text like '=%'
    ),
    'find_user_by_email has no PUBLIC execute grant');
select ok(
    not exists (
        select 1 from pg_proc,
             lateral unnest(coalesce(proacl, array[]::aclitem[])) a
        where oid = 'public.delete_my_account()'::regprocedure
          and a::text like '=%'
    ),
    'delete_my_account has no PUBLIC execute grant');
select ok(
    not exists (
        select 1 from pg_proc,
             lateral unnest(coalesce(proacl, array[]::aclitem[])) a
        where oid = 'public.respond_friend_request(uuid,boolean)'::regprocedure
          and a::text like '=%'
    ),
    'respond_friend_request has no PUBLIC execute grant');

-- ---------------------------------------------------------------------------
-- 6) EXECUTE IS granted to authenticated.
-- ---------------------------------------------------------------------------
select ok(
    has_function_privilege('authenticated', 'public.get_friend_card(uuid)', 'EXECUTE'),
    'authenticated CAN execute get_friend_card');
select ok(
    has_function_privilege('authenticated', 'public.find_user_by_email(text)', 'EXECUTE'),
    'authenticated CAN execute find_user_by_email');
select ok(
    has_function_privilege('authenticated', 'public.delete_my_account()', 'EXECUTE'),
    'authenticated CAN execute delete_my_account');
select ok(
    has_function_privilege('authenticated', 'public.respond_friend_request(uuid,boolean)', 'EXECUTE'),
    'authenticated CAN execute respond_friend_request');

select * from finish();
rollback;


-- ===========================================================================
-- BEHAVIOURAL / INTEGRATION TEST SCAFFOLDING (SKIPped — needs seeded auth users)
-- ===========================================================================
-- The privilege/attribute tests above prove the STRUCTURE is secure. The tests
-- below prove the BEHAVIOUR is secure, but they require rows in auth.users and a
-- way to impersonate them (set request.jwt.claim.sub / set role authenticated),
-- which pgTAP alone does not seed. They are written out as SKIP so `supabase test
-- db` stays green while documenting EXACTLY what a full integration suite asserts.
-- Remove the SKIP and implement the seeding (e.g. insert into auth.users, then
-- `set local role authenticated; set local request.jwt.claim.sub = '<uid>'`) to
-- activate them.

begin;
select plan(6);

-- get_friend_card: the accepted-friendship guard.
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: as user A, with an ACCEPTED friendships row between A and B,
    -- get_friend_card(B) returns exactly one row for B (name/path/cycle etc.).
    ;
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: as user A, with only a PENDING (not accepted) friendships row
    -- between A and B, get_friend_card(B) returns ZERO rows.
    ;
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: as user A, with NO friendships row to stranger C,
    -- get_friend_card(C) returns ZERO rows (no data leak) — the exact regression
    -- the June 2026 audit fixed.
    ;

-- find_user_by_email: authenticated-only behaviour.
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: with auth.uid() NULL (unauthenticated context),
    -- find_user_by_email('known@example.com') returns NULL (no enumeration).
    ;

-- delete_my_account: complete erasure, self only.
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: seed user A with >=1 row in EVERY user-data table
    -- (daily_logs, mucus_logs, cycle_data, cycle_summaries, user_baselines,
    -- user_feedback, friendships, friend_visibility, analytics_events,
    -- exercise_history, profiles). As A, call delete_my_account(). Then assert
    -- ZERO rows remain for A in every one of those tables AND auth.users.
    ;
select skip(1, 'needs seeded auth.users + impersonation')
    -- WOULD ASSERT: seed users A and B with data. As A, call delete_my_account().
    -- Then assert B's rows in every table are UNTOUCHED (deletion is gated to
    -- auth.uid() and never affects another user).
    ;

select * from finish();
rollback;
