# Supabase migrations — Em~power

Until now the Em~power Supabase database had **no version control**: no schema,
no RLS policies, and no function definitions lived in the repo. The
security-sensitive functions existed only as prose in the project `CLAUDE.md`.
These files change that: they are the version-controlled, reviewable source of
truth for the database's **intended** schema, RLS, and function security.

## What these files are (and aren't)

- They **encode the current intended state** described in
  [`../../../CLAUDE.md`](../../../CLAUDE.md) ("Database tables" and
  "Database security" sections) plus the actual column usage in the React app
  (`src/lib/hormoneSync.js`, `src/lib/analytics.js`, `src/lib/visitPrep.js`,
  `src/pages/Log.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Friends.jsx`,
  `src/pages/Workout.jsx`).
- They were **authored offline** — no live database was connected and none of
  this SQL has been executed. Treat them as a careful reconstruction, not a
  dump. Before adopting them as the baseline, run them against a **fresh/shadow**
  database (or `supabase db diff` against production) and reconcile any drift.
  The tables most likely to need reconciliation are `cycle_summaries` (not
  referenced anywhere in app code, so its columns are inferred from prose) and
  the return shape of `get_friend_card`.
- Where `CLAUDE.md` and the code disagreed, **the code wins** and a `-- NOTE:`
  comment marks the spot (e.g. `friendships.status` also allows `'declined'`;
  `user_baselines` is keyed by `id`, not `user_id`).

## Layout

| File | Purpose |
|---|---|
| `0001_init_schema.sql` | `create table if not exists` for all 11 tables (columns, PKs, unique constraints, FKs to `auth.users`); enables RLS on every table. |
| `0002_rls_policies.sql` | RLS policies scoped to `auth.uid()` for select/insert/update/delete on each table. friendships scoped to requester **or** addressee; friend_visibility owner-only. Re-runnable (`drop policy if exists` then `create policy`). |
| `0003_functions.sql` | Core `SECURITY DEFINER` functions with pinned search paths, internal authorization guards, and restricted execute grants. |
| `0004_check_constraints.sql` | Numeric and enum checks that reject implausible health values at the database boundary. |
| `0005_algorithm_provenance.sql` | Observation/import provenance, hormonal-context separation, performance-led progression fields, optional menarche year, and opt-in friend-card privacy. Adds guarded `respond_friend_request`. |

Tables covered: `profiles`, `cycle_data`, `daily_logs`, `mucus_logs`,
`cycle_summaries`, `user_baselines`, `user_feedback`, `friendships`,
`friend_visibility`, `exercise_history`, `analytics_events`.

## How to apply

Using the Supabase CLI (recommended):

```bash
# from empower-react/ (where supabase/ lives)
supabase db push                 # applies migrations in supabase/migrations
supabase test db                 # runs the pgTAP tests in supabase/tests
```

Or apply directly with psql (idempotent, safe to re-run):

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls_policies.sql
psql "$DATABASE_URL" -f supabase/migrations/0003_functions.sql
psql "$DATABASE_URL" -f supabase/migrations/0004_check_constraints.sql
psql "$DATABASE_URL" -f supabase/migrations/0005_algorithm_provenance.sql
```

## CRITICAL security rules (from CLAUDE.md — never weaken)

These are enforced by the pgTAP tests in `../tests/` and must hold for every
future change:

1. **Any new `SECURITY DEFINER` function bypasses RLS** — so it MUST check
   `auth.uid()` against the data it returns, and pin `set search_path = public`.
   A June 2026 audit found the friend functions had no internal guard and leaked
   every user's data to anyone with an email. Never regress this.
2. **`EXECUTE` must never be granted to `anon`/`public`** for a definer function
   unless the data is genuinely public. Revoke from `anon, public`; grant only to
   `authenticated`. Re-granting `find_user_by_email` to anon would turn it into an
   email-enumeration oracle.
3. **`get_friend_card` must keep its accepted-friendship guard** (an `accepted`
   `friendships` row between `auth.uid()` and the target, either direction).
4. **Any new user-data table MUST be added to `delete_my_account()`** so account
   erasure stays complete. `delete_my_account` deletes from every user table then
   the `auth.users` row, all gated to `auth.uid()`.
5. **RLS stays enabled on every table** with policies scoped to `auth.uid()`.
