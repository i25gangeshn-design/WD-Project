# Backroom

Backroom is an event inventory workspace. `final_frontend.html` is the authoritative reference and remains the page served at `/`; the current implementation branch adds the Supabase schema and Vercel serverless configuration without replacing its visual design.

## Existing connected projects

- GitHub: [`i25gangeshn-design/WD-Project`](https://github.com/i25gangeshn-design/WD-Project)
- Supabase: `WD Project`, ref `oxjsqmuguxaqdkfvpwmg`, region `ap-south-1`
- Vercel: existing `wd project` could not be inspected until team scope authorization is completed.

The repository started with only `final_frontend.html`. The Supabase project had no public tables or migrations at inspection. This migration is additive and does not drop existing data.

## Architecture decision

The frontend is a standalone HTML/CSS/JavaScript application. This work keeps that working foundation and preserves its CSS, responsive layout, interactions, and spreadsheet parser instead of migrating the UI to a new framework before its visual behavior can be checked. Vercel serves the existing HTML at `/` and hosts Node serverless functions under `api/`. Supabase Postgres/Auth/Storage provide the backend. The database uses normalized tables and RLS rather than treating browser storage as a database.

## Setup

1. Use Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and fill values from the existing Supabase project. Never commit `.env.local`.
3. Apply `supabase/migrations/202611230001_initial_schema.sql` to project ref `oxjsqmuguxaqdkfvpwmg` using the Supabase MCP migration tool or Supabase CLI linked to this ref.
4. Add the production and preview callback URLs to Supabase Auth URL Configuration. Set the site URL to the deployed domain.
5. Create a Cloudflare Turnstile widget for localhost and the production domain. Set the site key and secret in local/Vercel env.
6. Configure the existing Vercel project to the repository's production branch and root directory `.`. The `vercel.json` rewrite serves `/final_frontend.html` at `/`.

## Environment

| Variable | Browser/server | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Existing Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | RLS-protected client access |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Reserved for narrowly scoped server operations; never bundle into browser code |
| `NEXT_PUBLIC_SITE_URL` | public | Callback and canonical site URL |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public | Visible Turnstile widget |
| `TURNSTILE_SECRET_KEY` | server only | CAPTCHA verification in `/api/captcha/verify` |

`GET /api/config` returns only the public Supabase and CAPTCHA settings. `POST /api/captcha/verify` validates a Turnstile token with Cloudflare and gives safe, generic errors.

## Database

The migration creates profiles, events, event membership and hashed access codes, counted and tracked inventory, activity, per-user read state, indexes, timestamp triggers, RLS policies, storage bucket policies, and safe RPCs for event creation/join/code rotation and atomic quantity updates. Profile rows are created by an `auth.users` trigger. Access code hashes are not granted to browser roles. Images are private and limited to JPEG/PNG/WebP at 1.5 MB.

RLS is the authority for access checks. Deploy the migration only to the named existing project; inspect its output and generated types after applying. The seed data in the reference is demo-only and must not be used as production users or credentials.

## Deployment

The repository is served directly by the existing Vercel project. Add the variables above to Development, Preview, and Production as appropriate. Do not put service-role or Turnstile secret values in `NEXT_PUBLIC_*` variables. Configure production/preview Auth redirect URLs and Turnstile domains before enabling sign-up.

## Verification status

This branch preserves the frontend reference and includes a migration and serverless configuration. A production deployment and live Auth/CRUD flow require Vercel team authorization, configured project secrets, migration application, and browser integration verification. The prototype actions in the original HTML must not be represented as production-backed until that integration is completed.
