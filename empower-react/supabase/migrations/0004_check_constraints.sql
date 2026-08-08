-- 0004_check_constraints.sql
-- Defense-in-depth for numeric health values. The client validates in src/lib/validate.js, but the
-- database is the last line: RLS stops other users writing your rows, and these CHECKs stop ANY
-- client (including a future bug or a direct API call) persisting a physiologically impossible
-- value that would corrupt the algorithm. Bounds mirror RANGES in src/lib/validate.js.
--
-- Idempotent: drop-then-add so this migration can be re-applied. NULLs are always allowed (a field
-- that is simply not logged); the CHECK only constrains present values.

-- profiles
alter table public.profiles drop constraint if exists profiles_body_weight_kg_chk;
alter table public.profiles add constraint profiles_body_weight_kg_chk
  check (body_weight_kg is null or (body_weight_kg >= 25 and body_weight_kg <= 300));

alter table public.profiles drop constraint if exists profiles_cycle_length_chk;
alter table public.profiles add constraint profiles_cycle_length_chk
  check (cycle_length is null or (cycle_length >= 15 and cycle_length <= 90));

-- cycle_data
alter table public.cycle_data drop constraint if exists cycle_data_cycle_length_chk;
alter table public.cycle_data add constraint cycle_data_cycle_length_chk
  check (cycle_length is null or (cycle_length >= 15 and cycle_length <= 90));

-- daily_logs
alter table public.daily_logs drop constraint if exists daily_logs_resting_hr_exact_chk;
alter table public.daily_logs add constraint daily_logs_resting_hr_exact_chk
  check (resting_hr_exact is null or (resting_hr_exact >= 25 and resting_hr_exact <= 220));

alter table public.daily_logs drop constraint if exists daily_logs_wrist_temp_chk;
alter table public.daily_logs add constraint daily_logs_wrist_temp_chk
  check (wrist_temp is null or (wrist_temp >= 30 and wrist_temp <= 45));

alter table public.daily_logs drop constraint if exists daily_logs_sleep_hours_chk;
alter table public.daily_logs add constraint daily_logs_sleep_hours_chk
  check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24));

alter table public.daily_logs drop constraint if exists daily_logs_pain_rating_chk;
alter table public.daily_logs add constraint daily_logs_pain_rating_chk
  check (pain_rating is null or (pain_rating >= 1 and pain_rating <= 5));

alter table public.daily_logs drop constraint if exists daily_logs_hot_flash_count_chk;
alter table public.daily_logs add constraint daily_logs_hot_flash_count_chk
  check (hot_flash_count is null or (hot_flash_count >= 0 and hot_flash_count <= 50));

alter table public.daily_logs drop constraint if exists daily_logs_hormone_estradiol_chk;
alter table public.daily_logs add constraint daily_logs_hormone_estradiol_chk
  check (hormone_estradiol is null or (hormone_estradiol >= 0 and hormone_estradiol <= 100000));

alter table public.daily_logs drop constraint if exists daily_logs_hormone_progesterone_chk;
alter table public.daily_logs add constraint daily_logs_hormone_progesterone_chk
  check (hormone_progesterone is null or (hormone_progesterone >= 0 and hormone_progesterone <= 1000));

alter table public.daily_logs drop constraint if exists daily_logs_hormone_lh_chk;
alter table public.daily_logs add constraint daily_logs_hormone_lh_chk
  check (hormone_lh is null or (hormone_lh >= 0 and hormone_lh <= 500));

alter table public.daily_logs drop constraint if exists daily_logs_hormone_cortisol_chk;
alter table public.daily_logs add constraint daily_logs_hormone_cortisol_chk
  check (hormone_cortisol is null or (hormone_cortisol >= 0 and hormone_cortisol <= 5000));
