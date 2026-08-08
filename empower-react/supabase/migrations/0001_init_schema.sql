-- 0001_init_schema.sql
-- Em~power — initial schema (version-controlled reconstruction).
--
-- This migration encodes the CURRENT INTENDED state of the Supabase database as
-- documented in ../../../CLAUDE.md ("Database tables" section) and cross-checked
-- against actual column usage in the React app:
--   src/lib/hormoneSync.js, src/lib/analytics.js, src/lib/visitPrep.js,
--   src/pages/Log.jsx, src/pages/Dashboard.jsx, src/pages/Friends.jsx,
--   src/pages/Workout.jsx.
--
-- It was authored WITHOUT a live database connection. It uses
-- `create table if not exists` so it is safe to re-run. Column types are the
-- best-supported inference from the code (values written by the client) and the
-- doc; where the two disagreed, the code wins and a `-- NOTE:` explains it.
--
-- RLS is ENABLED on every table here; the actual policies live in 0002.

-- =============================================================================
-- profiles
-- One row per user. `id` is the auth.users uid (the client reads/writes by uid).
-- =============================================================================
create table if not exists public.profiles (
    id                  uuid primary key references auth.users (id) on delete cascade,
    email               text,
    name                text,
    user_path           text,          -- '1'..'6' onboarding path (stored as text in the app)
    bc_type             text,          -- birth-control type; repurposed to hold peri stage for path 4
    bc_stop_date        date,          -- only set for path 2
    cycle_length        integer,
    body_weight_kg      numeric,
    fitness_level       text,          -- 'Beginner' | 'Intermediate' | 'Advanced'
    onboarding_complete boolean default false,
    diet_preference     text,
    birth_year          integer,       -- age gate + age-aware guidance (year only, never full DOB)
    ethnicity           jsonb,         -- optional self-reported array of codes for mixed heritage
    pregnancy_due_date  date,          -- only set for the pregnancy path (user_path '6')
    created_at          timestamptz default now()
);

-- =============================================================================
-- cycle_data
-- =============================================================================
create table if not exists public.cycle_data (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null unique references auth.users (id) on delete cascade,
    last_period_date date,
    cycle_length     integer,
    notes            text,
    created_at       timestamptz default now()
);

-- =============================================================================
-- daily_logs
-- Upserted with onConflict 'user_id,log_date'.
-- =============================================================================
create table if not exists public.daily_logs (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references auth.users (id) on delete cascade,
    log_date             date not null,
    energy               text,
    symptoms             text[],
    workout_feel         text,
    mood                 text[],
    sleep_quality        text,
    resting_hr           text,          -- bucketed range value (e.g. '55 to 65')
    resting_hr_exact     integer,       -- exact bpm input (30-120)
    disruptors           text[],
    wrist_temp           numeric,       -- degrees C (34-40, step 0.1)
    temp_deviation       numeric,
    lh_result            text,          -- 'No test' | 'Negative' | 'Positive'
    hormone_estradiol    numeric,       -- pmol/L
    hormone_progesterone numeric,       -- nmol/L
    hormone_lh           numeric,       -- IU/L
    hormone_cortisol     numeric,       -- nmol/L
    flow_volume          text,          -- menstrual phase only
    pain_rating          integer,       -- menstrual phase only (1-5)
    hot_flash_count      integer,
    night_sweats_severity integer,
    joint_pain_rating    integer,
    joint_pain_location  text[],
    brain_fog_rating     integer,
    sleep_hours          numeric,       -- dedicated Sleep-screen hours (never overwrites notes)
    stress_level         integer,       -- 1-5, feeds allostatic load
    libido               text,          -- 'Low' | 'Normal' | 'High'
    notes                text,
    created_at           timestamptz default now(),
    constraint daily_logs_user_date_unique unique (user_id, log_date)
);

-- =============================================================================
-- mucus_logs
-- Upserted with onConflict 'user_id,log_date'.
-- =============================================================================
create table if not exists public.mucus_logs (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null references auth.users (id) on delete cascade,
    log_date       date not null,
    discharge_type text,
    spotting_type  text,
    notes          text,
    created_at     timestamptz default now(),
    constraint mucus_logs_user_date_unique unique (user_id, log_date)
);

-- =============================================================================
-- cycle_summaries
-- NOTE: not referenced anywhere in the current app code (read or write). Columns
-- are inferred from CLAUDE.md's prose ("cycle_number, cycle dates, phase lengths,
-- ovulation data"). Names/types below are a best-effort reconstruction and should
-- be reconciled against the live table before treating this migration as ground
-- truth for cycle_summaries specifically.
-- =============================================================================
create table if not exists public.cycle_summaries (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid not null references auth.users (id) on delete cascade,
    cycle_number         integer,
    cycle_start_date     date,
    cycle_end_date       date,
    follicular_length    integer,
    luteal_length        integer,
    ovulation_date       date,
    ovulation_confirmed  boolean,
    created_at           timestamptz default now()
);

-- =============================================================================
-- user_baselines
-- NOTE: primary key is `id` = the user's auth uid (NOT a separate user_id column).
-- Confirmed by src/lib/hormoneSync.js (upsert { id: userId } onConflict 'id') and
-- src/pages/VisitPrep.jsx (.eq('id', user.id)). CLAUDE.md's delete_my_account note
-- also says "user_baselines[id=uid]".
-- =============================================================================
create table if not exists public.user_baselines (
    id                       uuid primary key references auth.users (id) on delete cascade,
    avg_cycle_length         numeric,
    avg_luteal_length        numeric,
    temp_follicular_baseline numeric,
    rhr_follicular_baseline  numeric,
    pms_days_before          integer,
    peak_energy_day          integer,
    cycles_tracked           integer,
    model_confidence         numeric,
    updated_at               timestamptz default now()
);

-- =============================================================================
-- user_feedback
-- =============================================================================
create table if not exists public.user_feedback (
    id                       uuid primary key default gen_random_uuid(),
    user_id                  uuid references auth.users (id) on delete cascade,
    user_email               text,
    category                 text,
    screen                   text,
    description              text,
    followup_answer          text,
    frustration_rating       integer,
    priority                 text,
    status                   text default 'pending',
    claude_code_instruction  text,
    developer_notes          text,
    resolved_at              timestamptz,
    created_at               timestamptz default now()
);

-- =============================================================================
-- friendships
-- RLS scoped to requester_id or addressee_id.
-- NOTE: CLAUDE.md documents status as ('pending' | 'accepted'), but the code
-- (src/pages/Friends.jsx) also writes 'declined'. The CHECK below allows all
-- three so real writes are not rejected.
-- =============================================================================
create table if not exists public.friendships (
    id           uuid primary key default gen_random_uuid(),
    requester_id uuid not null references auth.users (id) on delete cascade,
    addressee_id uuid not null references auth.users (id) on delete cascade,
    status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined')),
    created_at   timestamptz default now(),
    constraint friendships_pair_unique unique (requester_id, addressee_id)
);

-- =============================================================================
-- friend_visibility
-- Owner-only flags. Keyed by user_id (upsert onConflict 'user_id').
-- Confirmed by src/pages/Friends.jsx: user_id, show_phase, show_streak,
-- show_sleep, show_workout.
-- =============================================================================
create table if not exists public.friend_visibility (
    user_id      uuid primary key references auth.users (id) on delete cascade,
    show_phase   boolean default false,
    show_streak  boolean default false,
    show_sleep   boolean default false,
    show_workout boolean default false,
    updated_at   timestamptz default now()
);

-- =============================================================================
-- exercise_history
-- PK (user_id, exercise). Upserted onConflict 'user_id,exercise'.
-- Confirmed by src/pages/Workout.jsx.
-- =============================================================================
create table if not exists public.exercise_history (
    user_id     uuid not null references auth.users (id) on delete cascade,
    exercise    text not null,
    last_weight numeric,
    last_reps   text,          -- NOTE: written as String(ex.reps) in Workout.jsx, so text.
    last_date   date,
    updated_at  timestamptz default now(),
    constraint exercise_history_pkey primary key (user_id, exercise)
);

-- =============================================================================
-- analytics_events
-- First-party analytics. Confirmed by src/lib/analytics.js:
-- insert { user_id, event, props }. `props` is a JSON object.
-- =============================================================================
create table if not exists public.analytics_events (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    event      text not null,
    props      jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

-- =============================================================================
-- Enable Row Level Security on every table (the 10 "public tables" plus
-- friend_visibility and exercise_history). Policies are defined in 0002.
-- ALTER ... ENABLE ROW LEVEL SECURITY is idempotent.
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.cycle_data        enable row level security;
alter table public.daily_logs        enable row level security;
alter table public.mucus_logs        enable row level security;
alter table public.cycle_summaries   enable row level security;
alter table public.user_baselines    enable row level security;
alter table public.user_feedback     enable row level security;
alter table public.friendships       enable row level security;
alter table public.friend_visibility enable row level security;
alter table public.exercise_history  enable row level security;
alter table public.analytics_events  enable row level security;
