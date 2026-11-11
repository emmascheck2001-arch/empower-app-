-- 0006_profile_settings_sync.sql
-- Persist workout goal and health-connection state on the profile so they survive
-- a new device, reinstall, or the PWA/native split. Wearable signals are a cached
-- derived snapshot from the connected health store; syncing them lets the cycle
-- pipeline keep using the latest imported signal across surfaces.

alter table public.profiles
  add column if not exists fitness_goal text,
  add column if not exists health_connected boolean default false,
  add column if not exists health_prompt_dismissed boolean default false,
  add column if not exists wearable_signals jsonb;
