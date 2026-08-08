-- 0002_rls_policies.sql
-- Em~power — Row Level Security policies.
--
-- Encodes the intended RLS model from CLAUDE.md:
--   "All 10 public tables have RLS enabled with policies scoped to auth.uid()
--    — no user can read another's data."
--
-- Every user-owned table restricts SELECT/INSERT/UPDATE/DELETE to the caller's
-- own rows via auth.uid(). friendships is scoped to the requester OR addressee;
-- friend_visibility is owner-only.
--
-- RLS itself is enabled in 0001. This file only (re)creates policies and is
-- re-runnable: every policy is DROPped IF EXISTS before being CREATEd.
--
-- Authored without a live database — no policies were executed here.

-- Helper convention: "own row" means the row's user_id (or id / owner column)
-- equals auth.uid(). WITH CHECK on INSERT/UPDATE prevents a user writing rows
-- attributed to someone else.

-- =============================================================================
-- profiles  (owner column: id)
-- =============================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
    for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
    for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
    for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
    for delete using (auth.uid() = id);

-- =============================================================================
-- cycle_data  (owner column: user_id)
-- =============================================================================
drop policy if exists cycle_data_select_own on public.cycle_data;
create policy cycle_data_select_own on public.cycle_data
    for select using (auth.uid() = user_id);

drop policy if exists cycle_data_insert_own on public.cycle_data;
create policy cycle_data_insert_own on public.cycle_data
    for insert with check (auth.uid() = user_id);

drop policy if exists cycle_data_update_own on public.cycle_data;
create policy cycle_data_update_own on public.cycle_data
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cycle_data_delete_own on public.cycle_data;
create policy cycle_data_delete_own on public.cycle_data
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- daily_logs  (owner column: user_id)
-- =============================================================================
drop policy if exists daily_logs_select_own on public.daily_logs;
create policy daily_logs_select_own on public.daily_logs
    for select using (auth.uid() = user_id);

drop policy if exists daily_logs_insert_own on public.daily_logs;
create policy daily_logs_insert_own on public.daily_logs
    for insert with check (auth.uid() = user_id);

drop policy if exists daily_logs_update_own on public.daily_logs;
create policy daily_logs_update_own on public.daily_logs
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists daily_logs_delete_own on public.daily_logs;
create policy daily_logs_delete_own on public.daily_logs
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- mucus_logs  (owner column: user_id)
-- =============================================================================
drop policy if exists mucus_logs_select_own on public.mucus_logs;
create policy mucus_logs_select_own on public.mucus_logs
    for select using (auth.uid() = user_id);

drop policy if exists mucus_logs_insert_own on public.mucus_logs;
create policy mucus_logs_insert_own on public.mucus_logs
    for insert with check (auth.uid() = user_id);

drop policy if exists mucus_logs_update_own on public.mucus_logs;
create policy mucus_logs_update_own on public.mucus_logs
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists mucus_logs_delete_own on public.mucus_logs;
create policy mucus_logs_delete_own on public.mucus_logs
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- cycle_summaries  (owner column: user_id)
-- =============================================================================
drop policy if exists cycle_summaries_select_own on public.cycle_summaries;
create policy cycle_summaries_select_own on public.cycle_summaries
    for select using (auth.uid() = user_id);

drop policy if exists cycle_summaries_insert_own on public.cycle_summaries;
create policy cycle_summaries_insert_own on public.cycle_summaries
    for insert with check (auth.uid() = user_id);

drop policy if exists cycle_summaries_update_own on public.cycle_summaries;
create policy cycle_summaries_update_own on public.cycle_summaries
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cycle_summaries_delete_own on public.cycle_summaries;
create policy cycle_summaries_delete_own on public.cycle_summaries
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- user_baselines  (owner column: id = auth uid)
-- =============================================================================
drop policy if exists user_baselines_select_own on public.user_baselines;
create policy user_baselines_select_own on public.user_baselines
    for select using (auth.uid() = id);

drop policy if exists user_baselines_insert_own on public.user_baselines;
create policy user_baselines_insert_own on public.user_baselines
    for insert with check (auth.uid() = id);

drop policy if exists user_baselines_update_own on public.user_baselines;
create policy user_baselines_update_own on public.user_baselines
    for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists user_baselines_delete_own on public.user_baselines;
create policy user_baselines_delete_own on public.user_baselines
    for delete using (auth.uid() = id);

-- =============================================================================
-- user_feedback  (owner column: user_id)
-- NOTE: get_all_feedback() (SECURITY DEFINER, self-checks Emma's uid) is the
-- intended read path for the advisor; these row policies keep ordinary users
-- scoped to their own feedback rows.
-- =============================================================================
drop policy if exists user_feedback_select_own on public.user_feedback;
create policy user_feedback_select_own on public.user_feedback
    for select using (auth.uid() = user_id);

drop policy if exists user_feedback_insert_own on public.user_feedback;
create policy user_feedback_insert_own on public.user_feedback
    for insert with check (auth.uid() = user_id);

drop policy if exists user_feedback_update_own on public.user_feedback;
create policy user_feedback_update_own on public.user_feedback
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_feedback_delete_own on public.user_feedback;
create policy user_feedback_delete_own on public.user_feedback
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- friendships  (scoped to requester_id OR addressee_id)
-- A user can see and act on a friendship row if they are either party.
-- INSERT: the caller must be the requester (you can only send your own request).
-- UPDATE is revoked from authenticated users in 0005; only the guarded
-- respond_friend_request() function can accept/decline. DELETE remains available to either party.
-- =============================================================================
drop policy if exists friendships_select_party on public.friendships;
create policy friendships_select_party on public.friendships
    for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester on public.friendships
    for insert with check (auth.uid() = requester_id);

drop policy if exists friendships_update_party on public.friendships;
create policy friendships_update_party on public.friendships
    for update using (auth.uid() = requester_id or auth.uid() = addressee_id)
    with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists friendships_delete_party on public.friendships;
create policy friendships_delete_party on public.friendships
    for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- =============================================================================
-- friend_visibility  (owner-only; owner column: user_id)
-- =============================================================================
drop policy if exists friend_visibility_select_own on public.friend_visibility;
create policy friend_visibility_select_own on public.friend_visibility
    for select using (auth.uid() = user_id);

drop policy if exists friend_visibility_insert_own on public.friend_visibility;
create policy friend_visibility_insert_own on public.friend_visibility
    for insert with check (auth.uid() = user_id);

drop policy if exists friend_visibility_update_own on public.friend_visibility;
create policy friend_visibility_update_own on public.friend_visibility
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists friend_visibility_delete_own on public.friend_visibility;
create policy friend_visibility_delete_own on public.friend_visibility
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- exercise_history  (owner column: user_id)
-- =============================================================================
drop policy if exists exercise_history_select_own on public.exercise_history;
create policy exercise_history_select_own on public.exercise_history
    for select using (auth.uid() = user_id);

drop policy if exists exercise_history_insert_own on public.exercise_history;
create policy exercise_history_insert_own on public.exercise_history
    for insert with check (auth.uid() = user_id);

drop policy if exists exercise_history_update_own on public.exercise_history;
create policy exercise_history_update_own on public.exercise_history
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists exercise_history_delete_own on public.exercise_history;
create policy exercise_history_delete_own on public.exercise_history
    for delete using (auth.uid() = user_id);

-- =============================================================================
-- analytics_events  (owner column: user_id)
-- Fire-and-forget inserts from the client; the user can only write/read own rows.
-- =============================================================================
drop policy if exists analytics_events_select_own on public.analytics_events;
create policy analytics_events_select_own on public.analytics_events
    for select using (auth.uid() = user_id);

drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own on public.analytics_events
    for insert with check (auth.uid() = user_id);

drop policy if exists analytics_events_update_own on public.analytics_events;
create policy analytics_events_update_own on public.analytics_events
    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists analytics_events_delete_own on public.analytics_events;
create policy analytics_events_delete_own on public.analytics_events
    for delete using (auth.uid() = user_id);
