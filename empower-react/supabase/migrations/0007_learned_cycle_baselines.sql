-- Persist the learned ovulation-timing and mucus-pattern fields that the cycle
-- model now derives from completed cycles, so the personalised phase engine can
-- reuse them across sessions instead of relearning from scratch each time.

alter table public.user_baselines
  add column if not exists avg_ovulation_day integer,
  add column if not exists ovulation_variation_days integer,
  add column if not exists avg_peak_mucus_day integer,
  add column if not exists mucus_peak_lead_days integer,
  add column if not exists confirmed_ovulation_cycles integer;
