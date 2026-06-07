# HelpMi Backend — Audit & Gap Analysis Report

**Prepared by:** Lead Solution Architect / Senior Backend Engineer
**Date:** 7 June 2026
**Scope:** Step 2 (Audit) + Step 3 inputs of the project plan. **No code written.**
**Source of truth:** `odd_jobs_marketplace_sri_lanka.pdf` (Product & Launch Strategy, v1)
**Codebase audited:** `backend/` (NestJS 11 + Prisma 7 + PostgreSQL)

---

## 1. Executive Summary

The backend is a well-structured NestJS monolith that covers the **happy path** of the marketplace: phone-OTP auth, task posting, a tier-gated task lifecycle, escrow records, two-sided ratings, in-app messaging, and an admin surface for KYC and disputes. The module boundaries are clean and the Prisma schema is mature and largely complete.

However, it is **not launch-ready**. Three categories of problems stand out:

1. **The notification subsystem is dead code.** `NotificationsService.send()` exists but is never called anywhere in the codebase. A "must-have for launch" item (push notifications for new tasks / accepted / messaged) is effectively unimplemented.
2. **The escrow flow has correctness bugs that move money incorrectly.** Tasks become acceptable and confirmable before funds are ever held, and `confirm` releases funds that may never have been collected. There is no 24-hour auto-release.
3. **There is no API documentation layer at all.** `@nestjs/swagger` is not installed; Step 5 (Swagger) is 0% done.

There is also a **runtime-breaking bug in KYC submission** (DTO field not present on the Prisma model), no rate limiting on OTP, and phone numbers are exposed in several responses despite the spec's hard requirement to mask them.

**Launch Readiness Score: 38 / 100** (detail in §10).

---

## 2. Current Architecture

| Aspect | Finding |
|---|---|
| Framework | NestJS 11, ESM (`.js` import specifiers), global `/api` prefix |
| ORM / DB | Prisma 7 + PostgreSQL. One migration (`20260516182122_init`) in sync with schema |
| Auth | JWT (Bearer) via `passport-jwt`; OTP-based login; global `JwtAuthGuard` (APP_GUARD) with `@Public()` opt-out |
| Authorization | `AdminGuard` (env allowlist of phone numbers); doer tier checks inline in `TasksService` |
| Validation | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) + class-validator DTOs |
| Config | `@nestjs/config` global; secrets via `.env` |
| Modules | 11 feature modules: auth, users, doer, categories, tasks, payments, ratings, messages, notifications, admin, prisma |
| Payments | PayHere hosted-checkout hash generation + webhook signature verification |
| Realtime | **None.** No WebSocket / Socket.IO. Chat and notifications are pure REST/polling |
| Tests | **None meaningful.** Only the default `app.controller.spec.ts` |
| API docs | **None.** No Swagger/OpenAPI |

**Overall:** the layering (controller → service → Prisma) is consistent and idiomatic. This is a solid foundation to extend; the gaps are missing features and a handful of logic bugs, not architectural rot.

---

## 3. Database & Prisma Review

The schema is the strongest part of the project. It models nearly every entity the spec describes.

**Models present:** `User`, `OtpToken`, `DoerProfile`, `KycReview`, `Category`, `Task`, `Escrow`, `Rating`, `Message`, `Dispute`, `Notification`.

**Enums present:** `DoerTier`, `KycStatus`, `TaskStatus`, `PaymentMode`, `EscrowStatus`, `PayoutMethod`, `DisputeStatus`, `MessageType`, `NotificationType`.

**What's well-designed:**

- Three-tier verification (`DoerTier` BRONZE/SILVER/GOLD) matches the spec's trust ladder exactly.
- `Escrow` separates `platformFeeFromPoster` (5%), `platformFeeFromDoer` (15%), `trustFundReserve` (5%), and `netDoerPayout` — directly modelling the revenue model in §5 of the spec.
- Trilingual category fields (`nameEn`, `nameSi`, `nameTa`) support the non-negotiable i18n requirement.
- Money columns use `Decimal(10,2)` — correct choice for currency.
- Sensible uniqueness: `Rating @@unique([taskId, raterId])`, `Escrow.taskId @unique`, `Dispute.taskId @unique`.

**Schema gaps / risks:**

1. **No payout destination on `DoerProfile`.** `PayoutMethod` enum and `Escrow.payoutMethod` exist, but the doer has nowhere to store a bank account number or mobile-wallet number. Payouts cannot actually be executed. The `SubmitKycDto.preferredPayoutMethod` field has no corresponding column (see §8, bug #1).
2. **No `datasource db { url }` / provider env wiring in `schema.prisma`** beyond `provider = "postgresql"` — the URL is supplied via `prisma.config.ts`. Works, but `prisma migrate`/`generate` behaviour depends on that config file being loaded.
3. **No `CashFee` / posting-fee entity.** The spec's flat Rs. 99 fee for cash tasks has no home.
4. **No `BankAccount` / `Payout` / `WalletTransaction` ledger.** Released escrow only flips a status; there is no record of an actual disbursement, which you will want for accounting (VAT on fees, segregated trust account reconciliation).
5. **No PostGIS / geospatial index.** `locationLat`/`locationLng` are plain floats; "nearby" is computed in application memory (see §6).
6. **`OtpToken.code` stored in plaintext.** Low severity at this scale but worth hashing.
7. **No soft-delete / `deletedAt`** on `Task` or `User` — relevant for PDPA "data deletion on request."

---

## 4. Authentication & Authorization Review

**Authentication flow (implemented):**

1. `POST /auth/otp/request` — finds or **auto-creates** a user by phone, generates a 6-digit OTP, stores it with expiry, and (currently) `console.log`s it. No SMS gateway is wired (`TODO` comment).
2. `POST /auth/otp/verify` — validates an unused, unexpired OTP, marks it used, issues a JWT `{ sub, phone }`.
3. Global `JwtAuthGuard` protects everything except `@Public()` routes. `JwtStrategy.validate` re-loads the user and rejects inactive/banned accounts on every request — good.

**Authorization:**

- **Admin:** `AdminGuard` checks the caller's phone against `ADMIN_PHONES` env allowlist. Simple and adequate for a solo founder, but not role-based and not auditable beyond the phone string.
- **Doer tier gating:** enforced in `TasksService.accept` and `findNearby` — correct and matches spec.

**Findings / risks:**

| # | Severity | Finding |
|---|---|---|
| A1 | **High** | **No rate limiting on OTP request.** `@nestjs/throttler` is absent. An attacker can spam SMS (cost/abuse) and enumerate/auto-create accounts. |
| A2 | High | **OTP is logged to console and stored in plaintext.** Acceptable only because no SMS gateway exists yet; must be fixed before any real send. |
| A3 | Medium | **No resend cooldown / max-attempts lockout** on OTP verification — brute-force of the 6-digit code is feasible within the 5-min window without attempt caps. |
| A4 | Medium | `GET /` (`AppController`) is **not** `@Public()`, so the health/root route returns 401. Harmless but surprising. |
| A5 | Low | JWT has no refresh-token mechanism; 7-day access token only. Acceptable for v1. |
| A6 | Low | Admin identity is a phone string in env — no admin user model, no audit trail of *which* admin acted beyond the stored phone. |

---

## 5. Validation & DTO Review

DTOs are generally well-validated with class-validator, and the global pipe strips unknown fields.

**Good:** `CreateTaskDto` (length bounds, `@Min(500)` budget floor — matches the "no task under Rs. 500" rule), `NearbyTasksDto` (radius/limit bounds), phone regex `^\+94[0-9]{9}$`, 6-digit OTP length.

**Gaps:**

1. **`raiseDispute` has no DTO.** The controller reads `@Body('reason')` as a raw string — no validation, no min length, can be empty/undefined and still create a `DISPUTED` task.
2. **Admin write endpoints use raw `@Body('...')` params** (`tier`, `note`, `resolutionNote`, `refundPoster`) instead of DTOs — no validation, `refundPoster` is not coerced to boolean.
3. **`SubmitKycDto.preferredPayoutMethod`** is validated but maps to a non-existent column (runtime bug, §8).
4. **No DTO for pagination** on `GET /admin/users` — `page`/`limit` parsed via `+page` with no bounds.
5. `CompleteTaskDto` requires `completionPhotoUrl` for *all* tasks; spec only mandates photo proof for *physical* tasks. Minor over-strictness.

---

## 6. Business Logic Review

### Task lifecycle (implemented)
`OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → (confirmed)`, plus `CANCELLED` and `DISPUTED`. Ownership/role checks are present on each transition (`ensureTaskDoer`, `ensureTaskPoster`). Tier eligibility is enforced on accept. This part is solid.

### Escrow logic (buggy — see §9 for severity)
- On task creation with `paymentMode = ESCROW`, an `Escrow` row is created `PENDING` with all fees pre-computed — **but the task is immediately `OPEN`**, so it is visible and acceptable before any money is collected.
- `initiatePayment` builds a correct PayHere hosted-checkout payload (MD5 hash per PayHere spec) and stores `payhereOrderId`.
- `handleWebhook` verifies the `md5sig` signature correctly and, on `status_code === '2'`, sets escrow `HELD` and task `OPEN`.
- `confirm` releases escrow **without checking it was ever `HELD`** and increments the doer's completed-job count.

### Ratings
Two-sided, 1–5, one per rater per task, recalculates `avgRating` and `onTimeRate` on the doer profile. Summary endpoint returns total/average/on-time — close to the spec's "X across N jobs, Y% on-time" display.

### Nearby search
Loads up to `limit*3` OPEN tasks from the DB, computes Haversine distance in JS, filters by radius, sorts featured-first then by distance. Correct results, but **not geospatially indexed** — fine for one suburb, will not scale and ignores the spec's PostGIS recommendation.

### KYC
Upsert of `DoerProfile` → status `PENDING`, flips `user.isDoer = true`. Admin approve/reject writes a `KycReview` audit row and sets tier. Logic is sound (modulo the payout-method bug).

### Admin
Stats, KYC queue, user ban/unban, dispute list + resolve (with escrow refund/release inside a transaction). Reasonable coverage for a manual-ops v1.

---

## 7. Existing Features (Inventory)

| Feature | Status | Notes |
|---|---|---|
| Phone-OTP signup/login | ⚠️ Partial | Logic complete; **no SMS gateway** (console only) |
| Separate poster/doer roles | ✅ | `isPoster` default true, `isDoer` set on KYC |
| Doer KYC submission | ⚠️ Partial | **Crashes** due to payout-method field (§8 #1) |
| 3-tier verification model | ✅ | BRONZE/SILVER/GOLD, tier-gated accept |
| Post a task | ✅ | Full DTO incl. location, budget, schedule |
| Browse nearby tasks | ✅ | In-memory Haversine; no PostGIS |
| Task lifecycle transitions | ✅ | Accept/start/complete/confirm/cancel |
| Photo proof of completion | ✅ | Required on `complete` |
| Escrow (hold/release/refund) | ⚠️ Buggy | Gating + confirm-without-hold bugs (§9) |
| PayHere checkout + webhook | ✅ | Hash + signature verified |
| Two-sided ratings | ✅ | With doer-stat recompute |
| In-app chat | ⚠️ Partial | Works, but **phone numbers exposed**, no masking |
| Notifications (in-app) | ⚠️ Partial | CRUD exists; **never created by any event** |
| Push notifications (FCM) | ❌ | `console.log` stub only; never invoked |
| Admin: KYC review | ✅ | Approve/reject + audit |
| Admin: ban/unban | ✅ | |
| Admin: disputes | ✅ | List + resolve with escrow action |
| Admin: stats | ✅ | Counts + escrow held sum |
| Trilingual categories | ✅ | Seeded EN/SI/TA |
| Cash-task flat Rs. 99 fee | ❌ | Not implemented |
| 24h escrow auto-release | ❌ | No scheduler |
| Doer payout execution | ❌ | No payout API, no bank/wallet storage |
| Swagger / OpenAPI | ❌ | Not installed |
| Automated tests | ❌ | Default spec only |

---

## 8. Complete API Inventory

Global prefix: `/api`. Auth column: **Public** = no token; **JWT** = bearer required; **Admin** = JWT + admin allowlist.

### Auth
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| POST | `/api/auth/otp/request` | Request OTP (auto-creates user) | Public | `RequestOtpDto {phone}` | `{message}` |
| POST | `/api/auth/otp/verify` | Verify OTP, issue JWT | Public | `VerifyOtpDto {phone, code}` | `{accessToken, user}` |

### Users
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/users/me` | Current user + doer profile | JWT | — | `User` |
| PATCH | `/api/users/me` | Update own profile | JWT | `UpdateUserDto` | `User` |
| GET | `/api/users/:id/profile` | Public profile + recent ratings | Public | — | public profile |

### Doer
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/doer/profile` | Own doer profile + reviews | JWT | — | `DoerProfile` |
| POST | `/api/doer/kyc` | Submit/resubmit KYC | JWT | `SubmitKycDto` | `DoerProfile` ⚠️ runtime bug |
| GET | `/api/doer/my-tasks` | Tasks assigned to doer | JWT | — | `Task[]` |

### Categories
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/categories` | Active categories | Public | — | `Category[]` |

### Tasks
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| POST | `/api/tasks` | Create task (+escrow if ESCROW) | JWT | `CreateTaskDto` | `Task` |
| GET | `/api/tasks/nearby` | Nearby OPEN tasks (tier-filtered) | JWT | `NearbyTasksDto` (query) | `Task[] + distance` |
| GET | `/api/tasks/my/posted` | Tasks I posted | JWT | — | `Task[]` |
| GET | `/api/tasks/my/accepted` | Tasks I accepted | JWT | — | `Task[]` |
| GET | `/api/tasks/:id` | Task detail | JWT | — | `Task` ⚠️ no participant check |
| POST | `/api/tasks/:id/accept` | Doer accepts | JWT | — | `Task` |
| POST | `/api/tasks/:id/start` | Doer marks in-progress | JWT | — | `Task` |
| POST | `/api/tasks/:id/complete` | Doer marks complete + photo | JWT | `CompleteTaskDto` | `Task` |
| POST | `/api/tasks/:id/confirm` | Poster confirms → release | JWT | — | `Task` ⚠️ releases w/o hold check |
| POST | `/api/tasks/:id/cancel` | Poster/doer cancels | JWT | — | `Task` |
| POST | `/api/tasks/:id/dispute` | Raise dispute | JWT | raw `{reason}` (no DTO) | `Task` |

### Payments
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/payments/:taskId` | Get escrow for task | JWT | — | `Escrow` |
| POST | `/api/payments/initiate/:taskId` | PayHere checkout payload | JWT | — | `{checkoutUrl, params}` |
| POST | `/api/payments/webhook` | PayHere notify callback | Public | `Record<string,string>` | `{received}` |

### Ratings
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| POST | `/api/ratings` | Rate a completed task | JWT | `CreateRatingDto` | `Rating` |
| GET | `/api/ratings/user/:userId` | Ratings + summary for a user | JWT | — | `{ratings, summary}` |

### Messages
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/messages/unread` | Unread count across tasks | JWT | — | `{unreadCount}` |
| GET | `/api/messages/:taskId` | Thread (marks read) | JWT | — | `Message[]` |
| POST | `/api/messages/:taskId` | Send message | JWT | `SendMessageDto` | `Message` |

### Notifications
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/notifications` | List (latest 50) | JWT | — | `Notification[]` |
| GET | `/api/notifications/unread-count` | Unread count | JWT | — | `{unreadCount}` |
| PATCH | `/api/notifications/read-all` | Mark all read | JWT | — | `{count}` |
| PATCH | `/api/notifications/:id/read` | Mark one read | JWT | — | `{count}` |

### Admin
| Method | Route | Purpose | Auth | Request DTO | Response |
|---|---|---|---|---|---|
| GET | `/api/admin/stats` | Dashboard metrics | Admin | — | stats object |
| GET | `/api/admin/kyc/pending` | Pending KYC queue | Admin | — | `DoerProfile[]` |
| PATCH | `/api/admin/kyc/:id/approve` | Approve KYC + set tier | Admin | raw `{tier}` | `DoerProfile` |
| PATCH | `/api/admin/kyc/:id/reject` | Reject KYC | Admin | raw `{note}` | `DoerProfile` |
| GET | `/api/admin/users` | Paginated users | Admin | query `page,limit` | `User[]` |
| PATCH | `/api/admin/users/:id/ban` | Ban user | Admin | — | `User` |
| PATCH | `/api/admin/users/:id/unban` | Unban user | Admin | — | `User` |
| GET | `/api/admin/disputes` | List disputes | Admin | query `status` | `Dispute[]` |
| PATCH | `/api/admin/disputes/:id/resolve` | Resolve dispute | Admin | raw `{resolutionNote, refundPoster}` | `{resolved}` |
| GET | `/api/` | Hello (health) | ⚠️ JWT (not Public) | — | `string` |

**Total: ~34 endpoints.**

---

## 9. Bugs & Correctness Issues (ranked)

| # | Severity | Location | Issue & Impact |
|---|---|---|---|
| B1 | **Critical** | `DoerService.submitKyc` | `...dto` spreads `preferredPayoutMethod` into `doerProfile.upsert`, but `DoerProfile` has no such column → **Prisma throws, KYC submission fails outright.** Either add columns or strip the field. |
| B2 | **Critical** | `TasksService.create` / `accept` | ESCROW tasks are `OPEN` immediately, before payment. A doer can accept (and start/complete) a task whose escrow is still `PENDING` — the "funds secured before accepting" guarantee is violated. |
| B3 | **Critical** | `TasksService.confirm` | Releases escrow (`RELEASED`) without checking it was ever `HELD`. A poster who never paid can confirm and the system marks funds as paid out → **phantom payout / accounting corruption.** |
| B4 | **High** | (missing) | **No 24-hour auto-release** of escrow. Spec requires auto-release if poster doesn't confirm in 24h. No scheduler/cron exists. |
| B5 | **High** | Notifications | `NotificationsService.send()` is never called from any lifecycle event → **no notifications are ever generated** (in-app or push). |
| B6 | Medium | `TasksService.markComplete` | Allows complete from `ASSIGNED` (skipping `IN_PROGRESS`/`started`). Lifecycle can be bypassed. |
| B7 | Medium | `findById` (`GET /tasks/:id`) | No participant check — any authenticated user can read any task's full detail incl. escrow figures and counterpart identity. |
| B8 | Medium | `PaymentsService.handleWebhook` | Sets task to `OPEN` unconditionally on success and is **not idempotent** — replays/duplicate notifies can resurrect a cancelled task or double-process. |
| B9 | Medium | `raiseDispute` | `reason` unvalidated; empty disputes possible. No DTO. |
| B10 | Low | `cancel` | On ESCROW cancel, only refunds if status `HELD`; PENDING escrow is left dangling (acceptable, but no cleanup). |
| B11 | Low | CORS | `origin: '*'` with credentials-style usage; tighten before production. |

---

## 10. Missing Features (vs. spec — MVP "must-have")

| Spec requirement (§8 must-have / §4) | Status | Gap |
|---|---|---|
| Phone OTP signup | ⚠️ | **SMS gateway not integrated** (Dialog/Mobitel/Twilio). Console only. |
| Doer NIC + selfie KYC | ⚠️ | Implemented but **broken at runtime** (B1). No file/image upload endpoint — expects pre-hosted URLs. |
| Post a task | ✅ | — |
| Browse nearby (map + list) | ✅ | No PostGIS; in-memory only. |
| Accept + chat + complete w/ photo | ✅ | Chat present but **no phone masking** (§4.5 violation). |
| PayHere escrow (hold + release) | ⚠️ | Present but buggy (B2/B3) and **no payout execution** to doer. |
| Two-sided 1–5 rating | ✅ | — |
| Admin panel (KYC/refund/ban) | ✅ (API) | API only; no UI (Next.js dashboard out of backend scope). |
| Trilingual UI (i18n) | ✅ (data) | Category translations seeded; backend ready. |
| **Push notifications** (new task / accepted / messaged) | ❌ | **Not wired at all** (B5) + no real FCM. This is a must-have. |
| Cash tasks → flat Rs. 99 fee | ❌ | No fee charged or recorded for CASH tasks. |
| Suggested price hint (§4.3) | ❌ | Not implemented (nice-to-have, not must-have). |
| Masked phone / contact expiry (§4.5) | ❌ | Phones exposed in `accept`, `my-tasks`. |

**Correctly deferred to v2 (per spec §8 "skip in v1"):** bidding mode, Gold-tier-only restrictions beyond model, Trust Fund payouts, female-doer filter, SOS button, live location, featured listings, subscriptions. No action needed now — but note `requiredTier` already supports GOLD and `isFeatured` exists in the schema.

---

## 11. Missing / Incomplete APIs

| Needed endpoint | Why | Priority |
|---|---|---|
| `POST /uploads` (NIC/selfie/task/completion images) | KYC and task photos currently require pre-hosted URLs; no upload path exists | **High** |
| Notification fan-out on lifecycle events | TASK_POSTED→nearby doers, TASK_ACCEPTED→poster, NEW_MESSAGE→counterpart, KYC_APPROVED/REJECTED, PAYMENT_RELEASED | **High** |
| `PATCH /tasks/:id` (edit) & richer cancel rules | Poster cannot edit a posted task | Medium |
| `POST /doer/payout-method` + payout execution | Store bank/wallet, trigger PayHere payout | **High** |
| Cash-task fee initiation (`/payments/cash-fee/:taskId`) | Collect the Rs. 99 posting fee | Medium |
| `GET /tasks/:id/dispute` & doer/poster dispute view | Participants can't view dispute state cleanly | Low |
| Scheduled job (not an API): 24h auto-release + OTP cleanup | Core escrow guarantee | **High** |
| `POST /auth/otp/resend` with cooldown | UX + abuse control | Medium |
| Health endpoint made `@Public()` | Ops/monitoring | Low |

---

## 12. Security Review

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| S1 | **High** | No rate limiting / throttling anywhere (esp. OTP) | Add `@nestjs/throttler`; per-phone OTP cooldown + global IP limits |
| S2 | **High** | OTP plaintext in DB + logged to console | Hash OTP; remove logging once SMS is live |
| S3 | High | Escrow money-movement bugs (B2/B3) | Gate accept on `HELD`; guard `confirm` |
| S4 | Medium | Phone numbers exposed in responses | Mask per spec §4.5; strip `phone` from task/accept payloads |
| S5 | Medium | Broad object exposure via `GET /tasks/:id` (B7) | Enforce participant-or-public-fields rule |
| S6 | Medium | Webhook not idempotent (B8) | Dedupe on `payment_id`; ignore terminal-state escrows |
| S7 | Medium | CORS `origin: '*'` | Restrict to app origins in production |
| S8 | Low | No `helmet`, no global exception filter, no structured logging | Add for production hardening |
| S9 | Low | Admin auth is env phone allowlist, no audit beyond stored phone | Acceptable v1; plan a proper admin role model |
| S10 | Low | No PDPA data-export/delete endpoints | Required by spec §10.4 before scale |
| S11 | Low | Money handled via JS `Number` in escrow math | Use Prisma `Decimal`/decimal lib to avoid float drift |

---

## 13. Swagger / OpenAPI Status

**0% complete.** `@nestjs/swagger` is not a dependency, `SwaggerModule` is not set up in `main.ts`, and no `@ApiProperty`/`@ApiTags`/`@ApiBearerAuth` decorators exist on any DTO or controller. Step 5 is entirely outstanding and will require: installing the package, a `SwaggerModule` bootstrap with a JWT bearer security scheme, and annotating every DTO and endpoint with request/response/error examples.

---

## 14. Launch Readiness Assessment

| Dimension | Score | Rationale |
|---|---|---|
| Data model | 8/10 | Mature; missing payout/ledger/cash-fee entities |
| Core task flow | 7/10 | Works; lifecycle can be partially bypassed (B6) |
| Auth | 5/10 | Solid JWT; no SMS, no throttling, plaintext OTP |
| Escrow / payments | 3/10 | Checkout works; **money-movement bugs**, no payout, no auto-release |
| Notifications | 1/10 | Dead code; a must-have feature is effectively absent |
| Messaging | 5/10 | Functional; no masking, no realtime |
| Admin | 7/10 | Good API coverage; raw-body validation gaps |
| Security | 4/10 | Multiple High items |
| API docs (Swagger) | 0/10 | Not started |
| Tests | 1/10 | None |

### **Overall Launch Readiness: 38 / 100 — NOT launch-ready.**

**Production risks:** (1) escrow can release uncollected funds — a financial-integrity risk that "loses you the company" per the spec's own warning; (2) no notifications kills the two-sided liquidity loop (doers never learn about new tasks); (3) KYC submission is currently broken; (4) SMS not integrated means no one can actually log in.

### Recommended remediation order (for Step 4, pending your approval)
1. **Fix the three Critical bugs** (B1 KYC, B2 escrow gating, B3 confirm guard) + add 24h auto-release (B4).
2. **Wire notifications** into every lifecycle event + integrate real FCM and SMS.
3. **Add file/image upload** for KYC and photos.
4. **Add payout-method storage + payout execution**; add cash-task Rs. 99 fee.
5. **Security hardening:** throttling, OTP hashing, phone masking, participant checks, webhook idempotency.
6. **Swagger** across all endpoints (Step 5).
7. **Tests** + Step 6 PASS/FAIL verification.

---

*End of audit. No code has been modified. Awaiting design-review approval (Step 3) before implementation (Step 4).*
