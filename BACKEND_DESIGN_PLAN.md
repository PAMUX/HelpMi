# HelpMi Backend — Step 3: Architecture & Design Review

**Prepared by:** Lead Solution Architect / Senior Backend Engineer
**Date:** 7 June 2026
**Status:** Design plan for approval. **No code written.**
**Companion document:** `BACKEND_AUDIT_REPORT.md`

This document is the implementation blueprint for every issue found in the audit. Work is grouped into four priorities. Each item specifies: (1) root cause, (2) proposed solution, (3) database changes, (4) API changes, (5) files modified, (6) risk level, (7) testing strategy.

Guiding principles (per project instructions): reuse existing code, do not rewrite working modules, follow the existing controller→service→Prisma pattern, keep backward compatibility, NestJS + Prisma best practices.

---

## 0. Cross-Cutting Architecture Decisions

These underpin multiple items below and should be approved first.

**0.1 Scheduling.** Introduce `@nestjs/schedule` (`ScheduleModule.forRoot()` in `AppModule`) to run periodic jobs (24h escrow auto-release, OTP cleanup). Single-process cron is sufficient at launch scale (one VPS, per spec §7). A `TasksSchedulerService` will live in a new `src/scheduler/` module to avoid bloating `TasksService`.

**0.2 Money handling.** Standardize all escrow/fee math on Prisma `Decimal` (via `@prisma/client/runtime` `Decimal` or `decimal.js`) instead of JS `Number`. A small `MoneyUtil` helper in `src/common/` centralizes fee computation (5% poster, 15% doer, 5% trust fund) so the percentages live in one place.

**0.3 Notification dispatch.** Notifications become an **event-driven side-effect**, not inline calls scattered through services. Use `@nestjs/event-emitter`: lifecycle services emit domain events (e.g. `task.accepted`); a `NotificationsListener` subscribes and persists + pushes. This keeps `TasksService` free of notification concerns and satisfies "do not rewrite working modules" (we add listeners, not rewrite logic).

**0.4 External-provider abstraction.** SMS and Push get provider interfaces (`SmsProvider`, `PushProvider`) with a concrete Dialog/Twilio and FCM implementation plus a `ConsoleProvider` for dev. Selected via env. This isolates third-party churn.

**0.6 Confirmed decisions (founder sign-off, 7 Jun 2026).**
- **Payouts (P3-A):** Wallet payouts (eZ Cash/FriMi) **automated via PayHere**; bank payouts handled as **manual admin CSV batch** (CEFTS/SLIPS) at launch.
- **Uploads (P2-C):** **S3-compatible object storage with presigned URLs** (AWS S3 / DigitalOcean Spaces); KYC objects in a private bucket/prefix, task photos public-read.

**0.5 Configuration validation.** Add a `validate` function (Joi or class-validator) to `ConfigModule.forRoot` so the app fails fast if required secrets (JWT, PayHere, SMS, FCM, upload) are missing.

---

# PRIORITY 1 — Financial Integrity & Blocking Bugs

These are launch-blocking. They corrupt money or break core flows. Ship these first, behind tests.

---

## P1-A — B1: KYC Submission Runtime Crash

**1. Root cause.** `DoerService.submitKyc` does `...dto` into `doerProfile.upsert`. `SubmitKycDto` includes `preferredPayoutMethod`, which is **not a column on `DoerProfile`**. Prisma rejects unknown fields at runtime → every KYC submission throws.

**2. Proposed solution.** Decide where payout preference belongs. Recommended: it *does* belong on the doer (it pairs naturally with KYC), so **add payout fields to `DoerProfile`** (this also unblocks P3-A). In the interim/minimal fix, destructure the DTO and map only known fields rather than blind-spreading. Final approach: add the columns + explicit field mapping (no blind spread) so future DTO drift can't reintroduce the bug.

**3. Database changes.** Add to `DoerProfile`: `preferredPayoutMethod PayoutMethod @default(BANK)`, `bankAccountName String?`, `bankAccountNumber String?`, `bankName String?`, `bankBranch String?`, `mobileWalletProvider String?`, `mobileWalletNumber String?`. New migration. (These columns are also consumed by P3-A.)

**4. API changes.** `POST /api/doer/kyc` contract unchanged for existing fields; `preferredPayoutMethod` now persists. Optionally extend `SubmitKycDto` with the bank/wallet fields (validated, all optional) — but full payout capture can be deferred to P3-A's dedicated endpoint to keep this fix minimal.

**5. Files modified.** `prisma/schema.prisma`, new `prisma/migrations/*`, `src/doer/doer.service.ts` (explicit field mapping), `src/doer/dto/submit-kyc.dto.ts` (only if extending now).

**6. Risk level.** **Low.** Additive schema change; explicit mapping is safer than the current spread. Backward compatible.

**7. Testing strategy.** Unit test `submitKyc` (create + resubmit/upsert paths) with a mocked Prisma; assert `preferredPayoutMethod` persists and no unknown-field error. E2E: submit KYC end-to-end returns 201 and a profile. Regression: confirm an already-APPROVED profile still throws `ConflictException`.

---

## P1-B — B2: Task Acceptable Before Escrow Is Funded

**1. Root cause.** `TasksService.create` sets ESCROW tasks to `OPEN` immediately and creates escrow as `PENDING`. The "funds secured before accept" guarantee (spec §4.2) is never enforced — `accept` does not check escrow status. The webhook later sets the task to `OPEN` again, but it was already open.

**2. Proposed solution.** Introduce a pre-funding state so ESCROW tasks are not browsable/acceptable until paid.
- On create with `ESCROW`: set task status to a new `PENDING_PAYMENT` state (not `OPEN`).
- `findNearby` already filters `status: 'OPEN'`, so pending-payment tasks are automatically hidden — no change needed there.
- The PayHere webhook (on `HELD`) transitions `PENDING_PAYMENT → OPEN` (it already sets `OPEN`; we make the source state explicit and guard it).
- `accept` gains an explicit guard: for ESCROW tasks, require `escrow.status === 'HELD'`.
- `CASH` tasks remain `OPEN` immediately (no escrow), but see P3-B (Rs. 99 fee gating).

**3. Database changes.** Add `PENDING_PAYMENT` to the `TaskStatus` enum. New migration. (Additive enum value — safe.)

**4. API changes.** No new endpoints. Behavioral change: `POST /api/tasks` for ESCROW now returns a task in `PENDING_PAYMENT`; the client must call `POST /api/payments/initiate/:taskId` next. `POST /api/tasks/:id/accept` now returns 400/403 if escrow not `HELD`. Document the new state in Swagger (P4-A).

**5. Files modified.** `prisma/schema.prisma`, new migration, `src/tasks/tasks.service.ts` (`create`, `accept`), `src/payments/payments.service.ts` (`handleWebhook` explicit transition), possibly `src/tasks/tasks.service.ts` `findNearby` (no change expected).

**6. Risk level.** **Medium.** Changes the posting flow the mobile app depends on; requires coordinated client update and clear documentation. Logic itself is contained.

**7. Testing strategy.** Unit: `create` yields `PENDING_PAYMENT` for ESCROW and `OPEN` for CASH; `accept` throws when escrow `PENDING`, succeeds when `HELD`. E2E: full flow create→initiate→webhook(HELD)→nearby shows task→accept succeeds; and negative path accept-before-pay → 400. Verify `findNearby` excludes `PENDING_PAYMENT`.

---

## P1-C — B3: Escrow Released Without Funds Held

**1. Root cause.** `TasksService.confirm` flips escrow to `RELEASED` and increments doer job count without checking the escrow was ever `HELD`. A poster who never paid can confirm, creating a phantom payout and corrupting the `escrowHeldLkr` accounting and doer stats.

**2. Proposed solution.** Guard the release path and make it atomic.
- In `confirm`, for ESCROW tasks: assert `escrow.status === 'HELD'` before releasing; otherwise throw `BadRequestException('Funds not secured')`.
- Wrap task-confirm + escrow-release + doer-stat increment in a single `prisma.$transaction`.
- Set `netDoerPayout` as the released amount and (with P3-A) enqueue a payout record rather than just flipping status.
- Emit `payment.released` event (P2-A) for notification.

**3. Database changes.** None for the guard itself. (Payout ledger arrives in P3-A.)

**4. API changes.** `POST /api/tasks/:id/confirm` now returns 400 if escrow not held. No new endpoints.

**5. Files modified.** `src/tasks/tasks.service.ts` (`confirm`), and the same transaction touches `escrow` + `doerProfile`.

**6. Risk level.** **Low–Medium.** Tightens an existing path; low risk of breaking legitimate flows, but must be tested against the new `PENDING_PAYMENT` state from P1-B.

**7. Testing strategy.** Unit: `confirm` throws when escrow `PENDING`/`DISPUTED`; succeeds and releases when `HELD`; doer `totalJobsCompleted` increments exactly once. E2E: pay→complete→confirm releases; never-paid→confirm rejected. Concurrency test: double-confirm does not double-increment (transaction + status guard).

---

## P1-D — B4: 24-Hour Escrow Auto-Release

**1. Root cause.** No scheduler exists. Spec §4.2/§6 require auto-release to the doer if the poster does not confirm within 24h of completion (disputes pause it).

**2. Proposed solution.** Add a cron job (per decision 0.1).
- `TasksSchedulerService` runs hourly: find tasks where `status = COMPLETED`, `confirmedAt IS NULL`, `completedAt <= now() - 24h`, escrow `HELD`, and no open dispute → run the same release transaction as `confirm` (extract shared `releaseEscrow(taskId)` into `TasksService` to avoid duplication).
- Disputes (`DISPUTED`) are excluded by the status filter, satisfying "disputes pause the release."
- Idempotent: the `HELD`-and-unconfirmed filter means already-released tasks are skipped.

**3. Database changes.** None (uses existing `completedAt`, `confirmedAt`, escrow status). Optionally add an index on `Task(status, completedAt)` for the scan.

**4. API changes.** None (internal job). Optionally expose `GET /admin/escrow/pending-release` for ops visibility (nice-to-have).

**5. Files modified.** `package.json` (add `@nestjs/schedule`), `src/app.module.ts` (`ScheduleModule.forRoot()`), new `src/scheduler/scheduler.module.ts` + `scheduler.service.ts`, `src/tasks/tasks.service.ts` (extract `releaseEscrow` helper), `prisma/schema.prisma` (optional index).

**6. Risk level.** **Medium.** Moves money automatically — must be correct and idempotent. Mitigated by reusing the audited `releaseEscrow` path and by the precise filter.

**7. Testing strategy.** Unit: job selects only eligible tasks (boundary at exactly 24h; excludes disputed, unpaid, already-confirmed). Use fake timers to simulate elapsed time. Integration: seed a completed-23h task (not released) and a completed-25h task (released). Idempotency: run job twice, single release. Verify a disputed task is never auto-released.

---

# PRIORITY 2 — Core Marketplace Features

Without these the two-sided loop doesn't function (doers can't be told about tasks; users can't actually log in; KYC needs real images).

---

## P2-A — Notification System (B5) + FCM Push

**1. Root cause.** `NotificationsService.send()` is never invoked; no lifecycle event creates notifications. FCM is a `console.log` stub. A must-have launch feature is absent.

**2. Proposed solution.** Event-driven dispatch (decision 0.3 + 0.4).
- Add `@nestjs/event-emitter`; emit typed domain events from `TasksService`, `Auth/DoerService`, `AdminService`, `MessagesService`, `PaymentsService`.
- New `NotificationsListener` maps each event → `NotificationsService.send(...)` (persist) → `PushProvider.send(...)` (FCM HTTP v1).
- Implement real FCM via `PushProvider` using FCM HTTP v1 (OAuth service-account); `ConsoleProvider` fallback in dev.
- Event→notification mapping (covers all `NotificationType` enum values):
  - `task.posted` → TASK_POSTED to eligible nearby doers (tier + radius reuse of `findNearby` logic).
  - `task.accepted` → TASK_ACCEPTED to poster.
  - `task.completed` → TASK_COMPLETED to poster.
  - `task.confirmed` / `payment.released` → TASK_CONFIRMED / PAYMENT_RELEASED to doer.
  - `task.cancelled` → TASK_CANCELLED to counterpart.
  - `task.disputed` → TASK_DISPUTED to counterpart + (optionally) admin.
  - `message.sent` → NEW_MESSAGE to counterpart.
  - `kyc.approved` / `kyc.rejected` → to doer.
  - `rating.received` → RATING_RECEIVED to ratee.

**3. Database changes.** None — `Notification` model and `NotificationType` enum already cover all cases. (Optional: index `Notification(userId, readAt)`.)

**4. API changes.** No new public endpoints (existing notification CRUD stays). Internally, services gain event emissions. `PATCH /users/me` already accepts `fcmToken` for device registration — sufficient.

**5. Files modified.** `package.json` (`@nestjs/event-emitter`), `src/app.module.ts` (`EventEmitterModule.forRoot()`), new `src/notifications/notifications.listener.ts`, new `src/notifications/providers/{push.provider.ts,fcm.provider.ts,console.provider.ts}`, `src/notifications/notifications.module.ts` (wire listener + provider, export nothing new), and emission points in `tasks.service.ts`, `doer.service.ts`/`admin.service.ts` (KYC), `messages.service.ts`, `payments.service.ts`, `ratings.service.ts`. Define event payload types in `src/notifications/events/`.

**6. Risk level.** **Medium.** Touches many services, but additively (emit-only). The risk is forgetting an event or notification-send failures bubbling into business transactions — mitigated by emitting *after* commit and catching/queueing push failures so they never roll back a task transition.

**7. Testing strategy.** Unit: each service emits the correct event with correct payload on each transition. Listener test: each event → one persisted notification of the right type + one push call (mocked provider). E2E: accept a task → poster has an unread TASK_ACCEPTED. Failure isolation test: push provider throwing does not fail the task transition. Fan-out test: `task.posted` notifies only tier-eligible in-radius doers, excluding the poster.

---

## P2-B — SMS OTP Integration

**1. Root cause.** `AuthService.requestOtp` only `console.log`s the code; no SMS gateway. No one can log in in production. OTP is plaintext and unthrottled (links to S1/S2, addressed in P3-C).

**2. Proposed solution.** Add an `SmsProvider` abstraction (decision 0.4) with a Sri Lanka gateway implementation (Dialog/Mobitel; Twilio as fallback) selected by env. `requestOtp` calls `SmsProvider.sendOtp(phone, code)`. Pair with OTP hashing and throttling (P3-C) — recommend shipping P2-B and the OTP-hardening parts of P3-C together since they touch the same method.

**3. Database changes.** None for sending. (Hashing `OtpToken.code` is a P3-C schema-free change — store a hash instead of plaintext; column type unchanged.)

**4. API changes.** `POST /auth/otp/request` contract unchanged. Add `POST /auth/otp/resend` (cooldown-guarded) as a convenience. Error responses for rate-limit (429) documented in Swagger.

**5. Files modified.** `package.json` (gateway SDK if any), new `src/auth/providers/{sms.provider.ts, <gateway>.provider.ts, console.provider.ts}`, `src/auth/auth.service.ts` (call provider; hash code), `src/auth/auth.module.ts` (provide SmsProvider), `.env.example` (gateway creds), config validation.

**6. Risk level.** **Medium** (external dependency, real cost). Mitigated by provider abstraction + sandbox/console mode + throttling to cap spend.

**7. Testing strategy.** Unit: `requestOtp` calls `SmsProvider.sendOtp` with the generated code; verify hash-compare on `verifyOtp` (plaintext never stored). Mock provider in tests. Integration with gateway sandbox before launch. Negative: provider failure surfaces a clean 5xx, no user-facing code leak.

---

## P2-C — Upload API for KYC & Task Photos

**1. Root cause.** KYC (`nicPhotoUrl`, `selfieUrl`, …) and task/completion photos are typed as `@IsUrl()` — the backend assumes images are already hosted somewhere. There is no upload path, so the mobile app has nowhere to put files.

**2. Proposed solution.** Add an `UploadsModule` providing presigned-URL uploads to object storage (S3-compatible: AWS S3 / DigitalOcean Spaces, matching spec §7 hosting).
- `POST /uploads/presign` returns a short-lived presigned PUT URL + the final public/object URL; client uploads directly to storage (keeps large files off the API, avoids PCI-style data on our servers).
- Restrict by `purpose` (`KYC_NIC`, `KYC_SELFIE`, `TASK_PHOTO`, `COMPLETION_PHOTO`), content-type allowlist (jpeg/png/webp), and size cap.
- KYC selfie/NIC objects go to a **private** bucket/prefix (sensitive PDPA data); task photos can be public-read. Existing DTOs keep `@IsUrl()` but validate the host belongs to our storage domain.
- Alternative if no object storage at launch: a multipart `POST /uploads` saving to a local/volume path served behind the API. Presigned-to-S3 is recommended for scale and ops simplicity.

**3. Database changes.** None required. (Optional `Upload` audit table: `id, userId, purpose, objectKey, contentType, createdAt` for cleanup/PDPA deletion — recommended.)

**4. API changes.** New: `POST /api/uploads/presign` (JWT) → `{uploadUrl, fileUrl, expiresAt}`. Optionally `POST /api/uploads` (multipart) fallback. Tighten KYC/task DTOs to require our storage host.

**5. Files modified.** `package.json` (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), new `src/uploads/{uploads.module.ts, uploads.controller.ts, uploads.service.ts, dto/presign.dto.ts}`, `src/app.module.ts` (import module), `.env.example` (bucket/keys), optionally `prisma/schema.prisma` (Upload table), and a hardened host check in `submit-kyc.dto.ts` / `create-task.dto.ts` / `complete-task.dto.ts`.

**6. Risk level.** **Medium.** New external dependency and a public-write surface; mitigated by presigned URLs (scoped, expiring), content-type/size limits, and private bucket for KYC.

**7. Testing strategy.** Unit: presign service returns a URL for an allowed purpose/content-type and rejects disallowed ones. Integration: presign → PUT to storage (or localstack/MinIO) → object retrievable. Security test: cannot presign without JWT; cannot exceed size/type; KYC objects not publicly listable.

---

# PRIORITY 3 — Payments Completeness & Hardening

---

## P3-A — Payout Methods & Payout Execution

**1. Root cause.** Releasing escrow only flips a status; there is no doer payout destination stored and no disbursement to bank/wallet. `netDoerPayout` is computed but never paid. No ledger for accounting (VAT on fees, segregated-trust reconciliation per spec §10.6).

**2. Proposed solution.**
- Persist payout destination on `DoerProfile` (columns added in P1-A).
- Add a `Payout` ledger entity recording each disbursement (amount, method, destination snapshot, status, provider ref).
- On escrow release (manual `confirm` and auto-release), create a `Payout` in `PENDING` and call `PayoutProvider` (PayHere payout REST API for wallet, or mark `BANK` payouts for batch CEFTS/SLIPS export). Provider abstraction mirrors decision 0.4.
- At launch, bank payouts may be **manual batch** (admin exports a CSV of `PENDING` bank payouts) — model supports this without blocking; wallet payouts can be automated via PayHere. This matches the spec's "settles next business day / manual early ops" reality.

**3. Database changes.** `DoerProfile` payout columns (from P1-A). New `Payout` model: `id, doerId, taskId, escrowId, amount Decimal, method PayoutMethod, status (PENDING/PROCESSING/PAID/FAILED), providerRef String?, destinationSnapshot Json, createdAt, paidAt`. New enum `PayoutStatus`. Migration.

**4. API changes.** `POST /api/doer/payout-method` (JWT) to set/update bank/wallet. `GET /api/doer/payouts` (JWT) doer's payout history. Admin: `GET /api/admin/payouts?status=`, `PATCH /api/admin/payouts/:id/mark-paid` (for manual bank batch), `GET /api/admin/payouts/export` (CSV).

**5. Files modified.** `prisma/schema.prisma` + migration, `src/doer/{doer.controller.ts,doer.service.ts,dto/payout-method.dto.ts}`, new `src/payments/providers/payout.provider.ts` (+ payhere impl), `src/tasks/tasks.service.ts` (`releaseEscrow` creates Payout), `src/scheduler/scheduler.service.ts` (auto-release path), `src/admin/{admin.controller.ts,admin.service.ts}`.

**6. Risk level.** **High.** Moves real money out of the platform. Mitigated by: ledger-first design (record before/around disbursement), idempotent provider refs, manual-batch option for bank at launch, and reconciliation reports.

**7. Testing strategy.** Unit: release creates exactly one `Payout` with correct `netDoerPayout` and method from profile. Idempotency: re-release does not create duplicate payouts (unique on `escrowId`). Provider failure → payout `FAILED`, escrow stays consistent, alert raised. Integration with PayHere payout sandbox. Reconciliation test: sum of `PAID` payouts + fees + trust reserve = collected escrow.

---

## P3-B — Cash-Task Flat Rs. 99 Fee

**1. Root cause.** CASH tasks create no escrow and no fee. Spec §5 requires a flat Rs. 99 platform fee collected at posting to "keep you in the loop."

**2. Proposed solution.** For `paymentMode = CASH`, create a lightweight fee charge at posting (reuse the PayHere checkout machinery for a Rs. 99 charge). Gate the task to `PENDING_PAYMENT` until the Rs. 99 is paid (mirrors P1-B), then `OPEN`. Model the fee either as a minimal `Escrow`-like row or a dedicated `PostingFee` record. Recommended: a small `PostingFee` entity to avoid overloading `Escrow` semantics.

**3. Database changes.** New `PostingFee` model: `id, taskId @unique, posterId, amount Decimal @default(99), status (PENDING/PAID/REFUNDED), payhereOrderId?, payherePaymentId?, paidAt?, createdAt`. Migration. (Alternatively a `feeMode` flag — but separate table is cleaner.)

**4. API changes.** `POST /api/tasks` for CASH now returns `PENDING_PAYMENT` + requires `POST /api/payments/initiate/:taskId` which (for CASH) charges Rs. 99. The existing webhook handles both escrow and posting-fee confirmation (branch on which record matches `payhereOrderId`). No new endpoints if `initiate`/`webhook` are generalized.

**5. Files modified.** `prisma/schema.prisma` + migration, `src/tasks/tasks.service.ts` (`create` for CASH), `src/payments/payments.service.ts` (`initiatePayment` + `handleWebhook` branch on PostingFee vs Escrow).

**6. Risk level.** **Medium.** Reuses proven PayHere path; main risk is webhook routing between two record types — mitigated by distinct order-id prefixes (e.g. `HM-` escrow vs `HMF-` fee) and explicit lookup.

**7. Testing strategy.** Unit: CASH task creates a `PostingFee` PENDING and task `PENDING_PAYMENT`; webhook PAID → fee `PAID`, task `OPEN`. Routing test: escrow vs posting-fee order IDs resolve to the right handler. Negative: unpaid CASH task not visible in `findNearby`.

---

## P3-C — Security Hardening

Bundles audit items S1–S11. Several are independent small changes; group into one hardening pass.

**1. Root cause.** No throttling (S1), plaintext/logged OTP (S2), exposed phone numbers (S4), unguarded `GET /tasks/:id` (S5/B7), non-idempotent webhook (S6/B8), open CORS (S7), no helmet/exception filter (S8), no PDPA endpoints (S10), float money (S11, covered by decision 0.2), unvalidated admin/dispute bodies (B9 + §5 gaps).

**2. Proposed solution.**
- **Throttling:** `@nestjs/throttler` global + stricter per-route limit on OTP request/verify (per-phone + per-IP).
- **OTP:** hash before store; remove console logging once SMS live; add max-verify-attempts + resend cooldown.
- **Phone masking:** stop returning counterpart `phone` in `accept`, `getMyTasks`, etc. Expose phone only when policy allows; otherwise rely on in-app chat. Add response serialization (class-transformer `@Exclude`/interceptor).
- **Participant guard on `GET /tasks/:id`:** return full detail only to poster/doer/admin; public/other users get limited fields.
- **Webhook idempotency:** dedupe on `payherePaymentId`; ignore terminal-state escrows; only transition from expected source state.
- **CORS:** restrict to configured app origins.
- **Helmet + global exception filter + structured logging** (and a global `HttpException` filter for consistent error shape used by Swagger examples).
- **DTOs for raw bodies:** `RaiseDisputeDto {reason}`, `ApproveKycDto {tier}`, `RejectKycDto {note}`, `ResolveDisputeDto {resolutionNote, refundPoster}`, pagination DTO for admin users.
- **PDPA:** `GET /users/me/export` (data export) and `DELETE /users/me` (soft-delete + anonymize) endpoints; add `deletedAt` to `User`.

**3. Database changes.** `User.deletedAt DateTime?` (soft delete). `OtpToken` add `attempts Int @default(0)` (optional). No type change for hashed code. Migration.

**4. API changes.** New: `GET /users/me/export`, `DELETE /users/me`, `POST /auth/otp/resend`. Behavioral: 429 on throttled routes; reduced fields in task/accept responses; participant-gated task detail. New DTOs on dispute/admin routes (validation only, same shapes).

**5. Files modified.** `package.json` (`@nestjs/throttler`, `helmet`), `src/app.module.ts` (ThrottlerModule + global guard/filter), `src/main.ts` (helmet, CORS origins, global exception filter), `src/auth/auth.service.ts` (hash/attempts), `src/auth/auth.controller.ts` (resend, throttle decorators), `src/tasks/{tasks.service.ts,tasks.controller.ts}` (masking, participant guard, RaiseDisputeDto), `src/admin/admin.controller.ts` (+ new DTOs), new `src/common/filters/http-exception.filter.ts`, new DTO files, `src/users/{users.controller.ts,users.service.ts}` (export/delete), `prisma/schema.prisma` + migration.

**6. Risk level.** **Medium.** Broad but mostly additive/defensive. Phone-masking and participant-gating could break clients relying on current responses — coordinate with mobile app and document.

**7. Testing strategy.** Unit: throttle limits trigger 429; OTP stored hashed and verifies; participant guard denies non-participants on `GET /tasks/:id`; webhook replay is idempotent; new DTOs reject malformed bodies. Security/E2E: OTP brute-force capped; CORS rejects unknown origin; PDPA export returns user's data and delete anonymizes. Regression: existing happy-path flows still pass with masked responses.

---

# PRIORITY 4 — Documentation & Quality

---

## P4-A — Swagger / OpenAPI

**1. Root cause.** `@nestjs/swagger` not installed; no `SwaggerModule`, no decorators. Step 5 is 0%.

**2. Proposed solution.** Install `@nestjs/swagger`; bootstrap `SwaggerModule` in `main.ts` at `/api/docs` with a JWT bearer security scheme (`addBearerAuth`) so the UI has an Authorize button. Annotate all DTOs (`@ApiProperty` with examples) and controllers (`@ApiTags`, `@ApiOperation`, `@ApiResponse` for success + error shapes, `@ApiBearerAuth`). Add response DTO classes where services currently return raw Prisma objects so schemas are accurate. Reuse the global exception filter's error shape for documented error responses.

**3. Database changes.** None.

**4. API changes.** New docs route `GET /api/docs` (+ `/api/docs-json`). All existing endpoints become documented; no behavioral change.

**5. Files modified.** `package.json`, `src/main.ts` (SwaggerModule), every `*.controller.ts` (decorators), every DTO (`@ApiProperty`), new response DTO classes under each module's `dto/`, optionally a `src/common/swagger/` for shared schemas.

**6. Risk level.** **Low.** Documentation-only; no runtime behavior change. Largest cost is breadth (every endpoint).

**7. Testing strategy.** Build passes; `/api/docs` loads; `/api/docs-json` is valid OpenAPI (validate with a schema linter). Manual: Authorize with a JWT and execute a protected call from the UI. Verify every endpoint and DTO appears with examples and error responses.

---

## P4-B — Test Coverage

**1. Root cause.** Only the default `app.controller.spec.ts`; no meaningful coverage. Step 6 cannot produce a credible PASS/FAIL report.

**2. Proposed solution.** Layered tests.
- **Unit (Jest):** every service method, Prisma mocked — prioritize escrow/payout/auth/notification logic (highest risk).
- **E2E (supertest + test DB):** auth→post→pay→accept→complete→confirm→rate; dispute path; admin KYC/ban/dispute; auto-release job; upload presign.
- **Test DB:** dockerized Postgres or a dedicated test schema with `prisma migrate deploy` + seed in CI setup.
- Target: ~80% on services, all critical money paths covered. Wire `test`/`test:e2e`/`test:cov` (scripts already exist) into a CI step that produces the Step 6 PASS/FAIL report.

**3. Database changes.** None (test DB only).

**4. API changes.** None.

**5. Files modified.** New `*.spec.ts` next to each service, `test/*.e2e-spec.ts`, `test/jest-e2e.json` (exists), CI config (new), `package.json` (test DB helpers if needed).

**6. Risk level.** **Low.** Additive; surfaces existing bugs (desirable).

**7. Testing strategy.** Self-referential — this *is* the testing work. Acceptance: `npm run build`, `prisma generate`, `prisma migrate deploy`, `npm test`, `npm run test:e2e` all green; coverage report generated; Swagger loads. That set becomes the Step 6 verification matrix.

---

## Summary — Execution Order & Dependencies

| Order | Item | Risk | Depends on |
|---|---|---|---|
| 1 | P1-A KYC bug + payout columns | Low | — |
| 2 | P1-B Pre-funding state | Medium | — |
| 3 | P1-C Confirm guard (+ shared `releaseEscrow`) | Low–Med | P1-B |
| 4 | P1-D 24h auto-release | Medium | P1-C, decision 0.1 |
| 5 | P2-A Notifications + FCM | Medium | decisions 0.3/0.4 |
| 6 | P2-B SMS OTP | Medium | decision 0.4 (pair w/ OTP hardening) |
| 7 | P2-C Uploads | Medium | — |
| 8 | P3-A Payouts | High | P1-A, P1-C, P1-D |
| 9 | P3-B Cash Rs. 99 fee | Medium | P1-B |
| 10 | P3-C Security hardening | Medium | P2-B (OTP), all above |
| 11 | P4-A Swagger | Low | endpoints stable |
| 12 | P4-B Tests | Low | runs alongside all |

**New dependencies to add:** `@nestjs/schedule`, `@nestjs/event-emitter`, `@nestjs/throttler`, `@nestjs/swagger`, `helmet`, `@aws-sdk/client-s3` (+ presigner), SMS gateway SDK, `decimal.js` (if not using Prisma Decimal directly).

**New modules:** `scheduler`, `uploads`; new providers under `auth`, `notifications`, `payments`; new listeners/events under `notifications`.

**Migrations (additive, backward-compatible):** payout columns on `DoerProfile`; `PENDING_PAYMENT` task status; `Payout` + `PayoutStatus`; `PostingFee`; `User.deletedAt`; optional `Upload` table and indexes. No destructive changes.

---

*End of Step 3 design plan. No code has been written. Awaiting approval to begin Step 4 implementation, starting with Priority 1.*
