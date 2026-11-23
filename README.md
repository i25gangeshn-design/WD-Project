# Backroom

Event inventory workspace based on the existing `final_frontend.html` interface. The project stays as HTML/CSS/JavaScript with Vercel serverless endpoints and Supabase Auth, Postgres, Realtime, and private Storage. This keeps the supplied design intact and avoids an unnecessary framework rewrite.

## Connected services

- GitHub repository: `i25gangeshn-design/WD-Project`
- Supabase project: `WD Project` (`oxjsqmuguxaqdkfvpwmg`, ap-south-1)
- Vercel project: `wd-project` (existing project; output directory is the repository root)

## Local setup

Use Node.js 20 or later. Copy `.env.example` to `.env.local`, set the Supabase public URL and publishable key, and configure a Cloudflare Turnstile widget for localhost. Keep the Turnstile secret server-only. The service-role key is not required by this client/RLS design.

Apply the versioned migrations in `supabase/migrations/` to the existing Supabase project. The schema is normalized, uses RLS, limits inventory images to a private bucket, and exposes security-checked RPCs for event creation/join/code rotation and atomic inventory updates. Configure the production and preview redirect URLs in Supabase Auth.

## Email signup and verification

Signup now has a six-digit email-code screen. Supabase `verifyOtp` confirms the account and creates the authenticated session, so the user enters the app immediately after verification. In the Supabase Dashboard, open **Authentication → Email Templates → Confirm signup** and make sure the template contains `{{ .Token }}` (the one-time code), not only `{{ .ConfirmationURL }}`. The Supabase project must have email confirmations enabled.

The Auth logs previously showed `over_email_send_rate_limit` and `email_not_confirmed`. Supabase's built-in mailer has a very low sending limit and may only send to organization-authorized addresses. For real users, configure a custom SMTP provider in **Authentication → Emails → SMTP Settings**. Do not add SMTP credentials to GitHub or browser-visible variables.

The Vercel project serves `final_frontend.html` at `/`, serves `/api/config` for public runtime configuration, and verifies Turnstile through `/api/captcha/verify`. Its output directory must remain `.` because this repository has no `public/` build folder. Configure these variables in the existing Vercel project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase publishable/anon key; public and RLS protected)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY` (server-only)
- `NEXT_PUBLIC_SITE_URL`

Do not configure a service-role key unless a future server-only operation specifically requires it. Never put secrets in `NEXT_PUBLIC_*` variables.

## Current verification

`node scripts/check.mjs` checks JavaScript syntax and the HTML script. `node --test tests/*.test.js` runs validation tests. The existing Vercel production alias returns HTTP 200. Email signup now supports OTP verification, but a full browser sign-up pass requires the Supabase confirmation template to contain `{{ .Token }}` and custom SMTP for delivery beyond the built-in limits.
