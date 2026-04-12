# Pulse — Feedback Platform

> Multi-tenant SaaS feedback platform replacing SurveyStance. Collects customer and employee feedback via kiosks, email, SMS, QR codes, and web.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router), React 19 |
| Monorepo | Turborepo + pnpm (Node ≥ 20) |
| Database | Supabase (PostgreSQL 15, RLS, Auth, Storage, Realtime) |
| Hosting | Vercel (3 cron jobs) |
| Styling | Tailwind CSS v3, shadcn/ui (Radix UI primitives) |
| State | Zustand (UI), TanStack Query (server), nuqs (URL) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| DnD | dnd-kit |
| i18n | next-intl with [locale] route segment |
| Offline | Dexie.js + Background Sync API + polling fallback |
| Testing | Vitest (unit), Playwright (E2E) |

## Monorepo Structure

```
apps/
  web/              # Main Next.js 15 app — all tenants
packages/
  db/               # Supabase client + generated types (@pulse/db)
  ui/               # Shared component library (@pulse/ui)
  config/           # ESLint / TS / Tailwind configs (@pulse/config)
supabase/
  migrations/       # SQL migrations (run in order)
  seed.sql
  config.toml
```

## App Router Layout

```
app/
├── (auth)/           # login, signup, invite/[token], sso/callback
├── (dashboard)/      # Protected — full sidebar nav
│   ├── surveys/[id]/build|logic|design|distribute|results
│   ├── analytics/
│   ├── reports/
│   ├── locations/
│   ├── team/
│   └── settings/
├── (survey)/         # Public — no auth; survey branding applied dynamically
│   ├── s/[token]/
│   └── embed/[token]/
├── kiosk/[token]/    # Full-screen PWA; bare layout, offline-capable
└── api/
    ├── submit/       # Service role — anonymous response submission
    ├── submit/batch/ # Offline bulk sync (idempotent upsert)
    ├── kiosk/bundle/ # Cached survey JSON for offline mode
    ├── cron/         # pulse-surveys | report-snapshots | cleanup-invitations
    └── org/invite/
```

## Multi-Tenancy

- Shared schema + RLS. Every tenant table has `organization_id`.
- `current_organization_id()` reads from `auth.jwt() -> 'app_metadata' ->> 'organization_id'`.
- Anonymous survey respondents use service role key via `/api/submit` (application-level token validation — no Supabase auth).
- Custom domain resolution via Vercel Edge Config (no DB hit).

## Key Files

| File | Purpose |
|---|---|
| `apps/web/middleware.ts` | Session refresh, tenant routing, auth redirect, x-org-id header injection |
| `apps/web/src/lib/supabase/server.ts` | `createServerClient`, `createServiceRoleClient` |
| `apps/web/src/lib/supabase/browser.ts` | Singleton browser client for Realtime |
| `packages/db/src/database.types.ts` | Auto-generated — run `pnpm db:generate-types` after every migration |
| `supabase/migrations/0001_initial_schema.sql` | All tables, RLS policies, indexes, triggers |

## Database Conventions

- All PKs: `UUID DEFAULT gen_random_uuid()`
- All tables: `created_at` + `updated_at` (auto via `moddatetime` trigger)
- Soft deletes: `deleted_at TIMESTAMPTZ` on mutable entities
- Extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`, `moddatetime` (+ `pgvector` pre-enabled for Phase 4)

## Custom Components (Must Build — Not in Any Library)

| Component | Description |
|---|---|
| `<SmileyRater />` | 5 SVG faces, animated hover, accessible radiogroup |
| `<NpsScale />` | 0–10 buttons, red→yellow→green gradient, labeled endpoints |
| `<KioskLayout />` | `position:fixed; inset:0; overflow:hidden; touch-action:none` |
| `<IdleScreen />` | Animated attract loop, tap-to-start, org logo |
| `<LogicRuleBuilder />` | Visual IF/THEN editor with AND/OR grouping (Phase 4) |
| `<ResponseHeatmap />` | Hour × Day CSS grid, color-intensity density |
| `<BrandedSurveyShell />` | CSS custom properties injector for per-survey theming |

## Development Commands

```bash
pnpm dev                    # Start all apps (Turbo)
pnpm build                  # Build all apps
pnpm lint                   # Lint all packages
pnpm typecheck              # Type-check all packages
pnpm test                   # Run Vitest
pnpm db:start               # Start local Supabase
pnpm db:reset               # Reset local DB + run migrations + seed
pnpm db:push                # Push migrations to remote Supabase
pnpm db:generate-types      # Regenerate packages/db/src/database.types.ts
```

## Git & GitHub

- Repo: GitHub (see remote for URL)
- **Every phase milestone gets a tagged commit** — e.g. `v0.1.0-phase1-complete`
- Commit convention: `type(scope): description`
  - Types: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `ci`
  - Scopes: `web`, `db`, `ui`, `config`, `supabase`, `kiosk`, `api`
  - Examples:
    - `feat(web): add NPS survey builder with dnd-kit reordering`
    - `feat(supabase): add RLS policies for response_answers`
    - `chore(db): regenerate database types after migration 0002`
- Branch convention: `phase{N}/{short-description}` — e.g. `phase1/survey-builder`
- PRs should reference the phase checklist item they complete

## Development Phases

See [PHASES.md](PHASES.md) for the full checklist with current progress.

| Phase | Scope | Status |
|---|---|---|
| Pre-Phase | Monorepo setup, schema, CI/CD | ✅ Complete |
| Phase 1 | Foundation — auth, survey builder, web distribution, dashboard | ✅ Complete |
| Phase 2 | Kiosk PWA, offline sync, QR, email/SMS, branding, i18n | ✅ Complete |
| Phase 3 | Analytics, reports, REST API, webhooks, integrations | ✅ Complete |
| Phase 4 | AI sentiment, skip logic, pulse surveys, SSO | ✅ Complete |
| Phase 5 | Predictive analytics, workflows, scale optimisation | ⬜ Not Started |

## Environment Variables

Copy `.env.example` to `.env.local`. Required for local dev:

```
NEXT_PUBLIC_SUPABASE_URL        # Local: http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY   # From supabase start output
SUPABASE_SERVICE_ROLE_KEY       # From supabase start output — server only
```

## Vercel Cron Jobs

Currently configured for **Hobby plan** (max 2 cron jobs, daily minimum):

```json
{ "crons": [
  { "path": "/api/cron/report-snapshots",    "schedule": "0 2 * * *" },
  { "path": "/api/cron/cleanup-invitations", "schedule": "0 0 * * *" }
]}
```

> **Pro plan upgrade required** to add `/api/cron/pulse-surveys` at hourly frequency (`0 * * * *`).
> Add it back to `vercel.json` when upgrading (Phase 4 — employee pulse surveys).
