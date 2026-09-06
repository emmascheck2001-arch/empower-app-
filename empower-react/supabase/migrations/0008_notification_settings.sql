-- Persist reminder preferences on the profile so local notifications survive a
-- reinstall, a new phone, or the native/web split. Delivery still remains
-- device-local; this only stores the user's opt-in and preferred reminder time.

alter table public.profiles
  add column if not exists notify_enabled boolean default false,
  add column if not exists notify_hour integer,
  add column if not exists notify_minute integer,
  add column if not exists notify_prompt_dismissed boolean default false;
