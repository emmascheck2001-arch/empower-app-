-- Support owner-scoped recent-class queries and account deletion.
create index if not exists workout_class_sessions_user_created_idx
  on public.workout_class_sessions (user_id, created_at desc);
