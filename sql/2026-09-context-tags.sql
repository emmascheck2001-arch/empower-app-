-- Em~power migration — life-context tags on the daily log
-- Run this in the Supabase SQL editor (project imgujppjvffbubnsscge).
--
-- WHY: every existing field in daily_logs is a body signal. This column records what the DAY
-- was (taught two classes, a deadline, travel, a late night), which is what lets the app
-- answer a question no hormone model can: does the same kind of day land differently in
-- different parts of the cycle? See src/lib/contextInsights.js.
--
-- SAFE TO RUN TWICE. The app also degrades gracefully if this has NOT been run: the first
-- save that hits a missing column retries without the field, so no entry is ever lost.

alter table public.daily_logs
  add column if not exists context_tags text[] default '{}'::text[];

comment on column public.daily_logs.context_tags is
  'Free-form life-context tags for the day (e.g. "Taught a class", "Deadline", "Travel"). '
  'Used only to correlate the kind of day against her own logged energy/sleep. Never shared, '
  'never used for a health claim. Deleted with the row by delete_my_account().';

-- RLS: daily_logs already has row-level security scoped to auth.uid(); a new column inherits
-- those policies, so nothing further is needed. delete_my_account() deletes whole daily_logs
-- rows, so erasure stays complete without a change there either.
