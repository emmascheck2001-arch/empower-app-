# Routing everything to the Em~power email

**Goal:** stop notifications going to your personal inbox; send them to **empowerhealthapp@gmail.com**.

## Already done (in the app code)
Every in-app place that shows or uses an email — support, feedback, "send to Em~power," Privacy, Terms — already uses **empowerhealthapp@gmail.com** (defined in one place: `empower-react/src/lib/appConfig.js`). Your personal email appears **nowhere** in the app anymore. New users never see it.

## What still goes to your personal inbox (and how to fix each)
These are **external service accounts** that email whoever owns the account. They can only be changed in each service's dashboard — I can't change them from code.

### 1. Supabase (database + auth) — most important
- **Project/billing/security alerts** → go to the account owner. Fix: Supabase → **Organization → Team/Members**, invite **empowerhealthapp@gmail.com** as an Owner, or change your account email under **Account Settings**.
- **Auth emails your USERS receive** (signup confirmation, password reset) currently come from Supabase's default sender. To send them **from** the Em~power address: Supabase → **Project → Authentication → Emails / SMTP settings** → configure custom SMTP (e.g. a Gmail app password for empowerhealthapp@gmail.com, or a service like Resend/Postmark). Until then they still send, just from Supabase's default address.

### 2. Netlify (web hosting)
- Deploy notifications + account emails → your Netlify account email. Fix: Netlify → **User settings → Email**, or **Site settings → Build & deploy → Deploy notifications** → point to empowerhealthapp@gmail.com.

### 3. GitHub (code)
- Notifications → your GitHub account email. Fix: GitHub → **Settings → Emails** (add empowerhealthapp@gmail.com) and **Settings → Notifications** → route to it.

### 4. Apple / App Store Connect
- Apple sends to your **Apple ID**, which is personal and generally shouldn't be changed. Best option: App Store Connect → **Users and Access** → invite **empowerhealthapp@gmail.com** with an Admin/App Manager role so it also receives app-related notifications (TestFlight, review status).

## Simplest catch-all (optional)
If per-service changes are tedious: set up **forwarding from your personal Gmail → empowerhealthapp@gmail.com** with a filter for these senders (Supabase, Netlify, GitHub, Apple), so everything lands in the Em~power inbox without touching each dashboard.
