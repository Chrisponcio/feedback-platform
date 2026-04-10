# Pulse — Phase Progress Tracker

> Last updated: 2026-04-10
> Current phase: **Phase 1 (Foundation)**

---

## Pre-Phase: Project Setup ✅

**Goal:** Monorepo scaffold, Supabase schema, CI/CD, tooling.

### Tasks
- [x] Turborepo monorepo — `apps/web`, `packages/db`, `packages/ui`, `packages/config`
- [x] `supabase/migrations/0001_initial_schema.sql` — all core tables, RLS, triggers, indexes
- [x] `packages/db/src/database.types.ts` — generated types
- [x] `apps/web/middleware.ts` — session validation, tenant routing, auth redirect, x-org-id header
- [x] `apps/web/src/lib/supabase/server.ts` — `createServerClient`, `createServiceRoleClient`
- [x] `apps/web/src/lib/supabase/browser.ts` — singleton browser client
- [x] App Router route group structure — `(auth)`, `(dashboard)`, `(survey)`, `kiosk/`, `api/`
- [x] Root layout (`app/layout.tsx`) — Inter font, metadata
- [x] GitHub repo created + initial commit pushed — https://github.com/Chrisponcio/feedback-platform
- [x] Vercel project deployed — root directory blank, `vercel.json` drives build from repo root
- [ ] Two Supabase projects created: `pulse-prod` and `pulse-staging`
- [ ] CI/CD: GitHub Actions → `supabase db push` on merge to main
- [ ] ESLint, Prettier, Husky pre-commit hooks configured
- [ ] Vitest + Playwright baseline configured

### Milestone
> Monorepo builds, Supabase schema applied locally, CI runs on push, preview deployments active.

---

## Phase 1: Foundation ⬜

**Goal:** Working multi-tenant app — auth, survey creation (NPS/CSAT/smiley/open_text/multiple_choice/star_rating), web distribution, real-time dashboard. Parity with SurveyStance fundamentals.

**Target:** Months 1–2

### Tasks
- [ ] Auth: Supabase email/password sign-in, org registration flow
- [ ] Custom Access Token hook (Postgres function): enriches JWT with `organization_id` + `role`
- [ ] Org onboarding: create `organizations` + `organization_members` rows, redirect to dashboard
- [ ] Invitation accept flow at `(auth)/invite/[token]`
- [ ] Survey builder: Zustand builder store with undo/redo (command pattern)
- [ ] dnd-kit question reordering in builder
- [ ] Question types: `nps`, `csat`, `smiley`, `open_text`, `multiple_choice`, `star_rating`
- [ ] Survey settings: title, language, thank-you message, redirect URL, response limit
- [ ] Web distribution: generate `survey_distributions` row (`channel: web_link`), public URL `/s/[token]`
- [ ] Survey runner: `SurveyRunner` client component, state machine for question progression
- [ ] Zod-validated submission to `POST /api/submit`
- [ ] `POST /api/submit/route.ts` — service role response submission
- [ ] Basic dashboard: response count, NPS gauge, CSAT average, recent response feed
- [ ] TanStack Query + Supabase SSR prefetch via `HydrationBoundary`
- [ ] Supabase Realtime: subscribe to `responses INSERT` for live counter updates
- [ ] RBAC: middleware + server-action guards check JWT role claim before mutations
- [ ] Custom components: `<NpsScale />`, `<SmileyRater />`

### Packages to Add
`dnd-kit` (core + sortable + utilities), `shadcn/ui`

### Verification Checklist
- [ ] New org can register, invite a team member, that member can accept and log in
- [ ] Admin creates NPS + CSAT + smiley + open-text survey, gets shareable URL
- [ ] Respondent submits survey; response appears in real-time dashboard within 2 seconds
- [ ] Viewer role cannot create/delete surveys (server action returns 403)

### Milestone
> Org admin creates a multi-question NPS/CSAT survey, shares the link, collects responses, sees live results.

### Git Tag
`v0.1.0-phase1-complete`

---

## Phase 2: Kiosk & Distribution ⬜

**Goal:** Kiosk PWA with offline sync, QR code generation, email/SMS distribution, custom branding, multi-language. Full SurveyStance parity.

**Target:** Months 3–4

### Tasks
- [ ] Kiosk PWA: `public/manifest.json` (fullscreen, landscape), service worker via `next-pwa`
- [ ] `app/kiosk/[token]/layout.tsx` — bare shell, `<KioskLayout>` component
- [ ] Custom component: `<KioskLayout />` — `position:fixed; inset:0; overflow:hidden; touch-action:none`
- [ ] Custom component: `<IdleScreen />` — animated attract loop, tap-to-start
- [ ] Dexie.js offline storage schema: `pendingResponses`, `kioskConfig`, `surveyCache`, `syncLog`
- [ ] `GET /api/kiosk/bundle` — full survey JSON + branding, ETag-based 304
- [ ] Background Sync API + polling fallback (30s) for iOS Safari
- [ ] `POST /api/submit/batch` — idempotent upsert with `ON CONFLICT (session_id) DO UPDATE`
- [ ] `useIdleTimeout` hook — configurable timeout, auto-reset, new `sessionId`
- [ ] QR code: `POST /api/survey/qr` → PNG via `qrcode` → Supabase Storage → URL
- [ ] Email distribution: `survey_distributions` + Resend SDK
- [ ] SMS distribution: Twilio SMS
- [ ] Custom branding: `<BrandedSurveyShell>` — CSS custom properties from `surveys.branding` jsonb
- [ ] Multi-language: `next-intl` `[locale]` route segment, `messages/` directory, RTL support
- [ ] Locations: CRUD for `locations` table; associate kiosk distribution with location
- [ ] Kiosk setup/pairing page

### Packages to Add
`next-pwa`, `dexie`, `qrcode`, `resend`, `twilio`, `next-intl` (already installed — wire up)

### Verification Checklist
- [ ] Install kiosk PWA on iPad via "Add to Home Screen"; no browser chrome visible
- [ ] Disable WiFi; submit 5 responses; re-enable; confirm all 5 appear with no duplicates
- [ ] QR code PNG generates and scans correctly on mobile
- [ ] Survey renders in Spanish; Arabic renders with correct RTL

### Milestone
> iPad in kiosk mode collects responses offline for 8h, syncs on reconnect with zero duplicates.

### Git Tag
`v0.2.0-phase2-complete`

---

## Phase 3: Analytics & Integrations ⬜

**Goal:** Advanced reporting, trend analysis, REST API, webhooks, Slack, Salesforce/HubSpot, automated alerts.

**Target:** Months 5–6

### Tasks
- [ ] Custom report builder: dnd-kit section canvas, section types (chart/metric/table/text)
- [ ] PDF export: Puppeteer → headless render → Supabase Storage → signed URL
- [ ] CSV/Excel export: `xlsx` package, streamed download
- [ ] Trend analysis: Postgres `date_trunc` time-bucketed queries
- [ ] Anomaly detection: z-score vs. rolling 30-day baseline
- [ ] Pre-computed snapshots: `/api/cron/report-snapshots` → `report_snapshots` table
- [ ] `<ResponseHeatmap />` — Hour × Day CSS grid
- [ ] REST API: `app/api/v1/` — API key auth (`api_keys` table, bcrypt-hashed)
- [ ] Webhooks: `outbound_webhooks` table, Edge Function, retry (3× exponential backoff)
- [ ] Zapier REST Hooks trigger
- [ ] Slack OAuth integration + formatted notifications
- [ ] Alert rules: `alert_rules` table, hourly cron evaluation, Resend/Slack notify
- [ ] Salesforce/HubSpot: OAuth 2.0, encrypted credentials, NPS → CRM custom field

### Packages to Add
`puppeteer-core`, `@sparticuz/chromium`, `xlsx`, `@slack/web-api`, `bcryptjs`

### Verification Checklist
- [ ] Build and export a custom PDF report; file opens with correct charts
- [ ] API key authenticates against `GET /api/v1/surveys`; wrong key returns 401
- [ ] Slack alert fires within 60s of NPS dropping below threshold

### Milestone
> Admin builds NPS trend report, exports PDF, sets Slack alert for NPS < 20, receives notification on detractor submission.

### Git Tag
`v0.3.0-phase3-complete`

---

## Phase 4: Intelligence & Scale ⬜

**Goal:** AI sentiment analysis, skip logic/branching, employee pulse surveys, SSO/SAML, geolocation.

**Target:** Months 7–9

### Tasks
- [ ] Skip logic: `questions.logic` jsonb rule tree, `evaluateLogic()` client-side evaluator
- [ ] `<LogicRuleBuilder />` — visual IF/THEN editor with AND/OR grouping
- [ ] AI sentiment: OpenAI `text-embedding-3-small` embeddings → pgvector, `gpt-4o-mini` classification
- [ ] Supabase Edge Function: processes `open_text` answers async → writes `response_tags`
- [ ] Enable `pgvector` extension in migration
- [ ] Sentiment dashboard: word cloud, sentiment trend chart, topic cluster view
- [ ] Survey templates: `survey_templates` table, 10 starter templates, picker modal
- [ ] Employee pulse surveys: `pulse_schedules` table, `/api/cron/pulse-surveys`, anonymity mode
- [ ] SSO/SAML: Supabase SAML 2.0 SP, org-level config, `signInWithSSO({ domain })`
- [ ] SSO config UI in `/settings/sso`
- [ ] Multi-org user switching: re-issue JWT with new `organization_id` claim
- [ ] Geolocation tagging: `navigator.geolocation` → `responses.metadata.geo`
- [ ] Geolocation map analytics: `react-map-gl` + Mapbox

### Packages to Add
`openai`, `react-map-gl`, `mapbox-gl`, `react-wordcloud`

### Verification Checklist
- [ ] Skip logic: NPS < 7 routes to follow-up; NPS ≥ 9 jumps to thank-you
- [ ] Open-text response gets `response_tags` with sentiment + topic within 60s
- [ ] SSO org member logs in via SAML IdP; `organization_id` correctly in JWT

### Milestone
> Weekly pulse sends automatically; open-text AI-tagged within 60s; enterprise SSO login works.

### Git Tag
`v0.4.0-phase4-complete`

---

## Phase 5: Advanced Features & Optimization ⬜

**Goal:** Predictive analytics, follow-up workflows, digital signage, gamification, video questions, performance hardening.

**Target:** Months 10–12

### Tasks
- [ ] Predictive analytics: ML model for churn/satisfaction, `org_predictions` table
- [ ] Follow-up workflows: `workflow_triggers` table, visual workflow builder
- [ ] Zendesk integration: OAuth, auto-create tickets for NPS < 7
- [ ] Digital signage: `/signage/[token]` — full-screen live NPS/CSAT display, Realtime-driven
- [ ] Gamification: progress bar, confetti (`canvas-confetti`), optional incentive code
- [ ] Video/image questions: `media_question` type, Supabase Storage
- [ ] Postgres partitioning: `responses` partitioned by `created_at` month
- [ ] Vercel KV cache: dashboard metrics 30s TTL, invalidated by Realtime
- [ ] Graduated Realtime: at 200k+/month, switch to snapshot polling at 5s interval

### Packages to Add
`canvas-confetti`, `@vercel/kv`

### Verification Checklist
- [ ] Dashboard renders < 3s with 100k responses (Playwright + `performance.now()`)
- [ ] NPS < 7 → Zendesk ticket created within 5s
- [ ] Signage page updates live NPS within 1s of new response

### Milestone
> 100k responses/month, dashboard < 3s, Zendesk ticket in 5s, signage sub-second updates.

### Git Tag
`v0.5.0-phase5-complete`
