-- A manually logged class is its own record; it must not overwrite a daily
-- workout observation or be marked as a wearable import.
create table if not exists public.workout_class_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  activity text not null check (activity in ('swim', 'cycle', 'pilates', 'yoga', 'gym', 'run', 'hiit', 'other')),
  duration_minutes integer check (duration_minutes between 1 and 1440),
  created_at timestamptz not null default now()
);

alter table public.workout_class_sessions enable row level security;

drop policy if exists workout_class_sessions_select_own on public.workout_class_sessions;
create policy workout_class_sessions_select_own on public.workout_class_sessions for select using (auth.uid() = user_id);
drop policy if exists workout_class_sessions_insert_own on public.workout_class_sessions;
create policy workout_class_sessions_insert_own on public.workout_class_sessions for insert with check (auth.uid() = user_id);
drop policy if exists workout_class_sessions_delete_own on public.workout_class_sessions;
create policy workout_class_sessions_delete_own on public.workout_class_sessions for delete using (auth.uid() = user_id);

-- Supabase default privileges can grant broad table access, including TRUNCATE,
-- which row-level security does not protect. Limit access explicitly.
revoke all on public.workout_class_sessions from public, anon, authenticated;
grant select, insert, delete on public.workout_class_sessions to authenticated;
