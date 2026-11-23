# Implementation audit

Updated 2026-11-23 from repository checks and connected Supabase/Vercel state. “Partial” means code or configuration exists but the complete user flow has not been verified.

| Requirement | Implemented in | Verification | Status |
|---|---|---|---|
| Existing project selection | Vercel project `wd-project`; Supabase ref `oxjsqmuguxaqdkfvpwmg` | Existing project IDs and status inspected | Complete |
| Root page / Vercel output | `vercel.json`; existing Vercel project output directory `.` | Preview deployment READY; `/` returned HTTP 200 | Complete for preview |
| Supabase schema | `supabase/migrations/` | Three migrations applied; 11 public tables and RLS inspected | Complete |
| Authentication | `final_frontend.html`, `lib/backend.js` | Supabase Auth calls wired; no test account or end-to-end login run | Partial |
| CAPTCHA | `api/captcha/verify.js`, Turnstile widget in `final_frontend.html` | Server verification implemented; Vercel site/secret keys are not configured, login correctly remains disabled | Partial / blocked on keys |
| Client/server validation | `lib/validation.js`, form validation, API endpoint checks, SQL constraints/RPCs | `node --test tests/*.test.js`: 3 passed; no browser validation pass | Partial |
| CRUD and role checks | `lib/backend.js`, Supabase RLS/RPCs | Client mutations wired; no full role-matrix integration test | Partial |
| Activity/read state | `lib/backend.js`, activity and read-state tables | Persistence paths implemented; no multi-user validation | Partial |
| Realtime | `lib/backend.js` workspace subscriptions; frontend event binding | Channel implementation present; no concurrent-browser test | Partial |
| Search/filter/sort | Existing `final_frontend.html` UI | Retained; not verified with live rows | Partial |
| Image storage | `lib/backend.js`, private `inventory-images` bucket/policies | Bucket and policies verified; no live upload/download test | Partial |
| CSV/XLSX import | Existing spreadsheet parser and import UI | Parsing retained; server-side batch transaction not implemented | Incomplete |
| Responsive design | Existing `final_frontend.html` CSS | Source preserved; no screenshot comparison run | Partial |
| Production environment | Existing Vercel project | No environment variables configured; Turnstile credentials needed | Incomplete |
| Production deployment | Existing production alias | Not promoted; feature branch preview verified instead | Incomplete |
| Local checks | `scripts/check.mjs`, `tests/validation.test.js` | Syntax/document check passed; 3 tests passed; no npm binary available | Partial |

Preview URL: `https://wd-project-cqcnwph2b-i25gangeshn-2614.vercel.app/`. The existing production alias was not changed. Configure Turnstile on the existing Cloudflare account and enter its site and secret keys directly in Vercel before enabling Auth; then run browser verification and promote the reviewed branch.
