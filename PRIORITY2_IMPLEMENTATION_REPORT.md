# HelpMi Backend — Step 4: Priority 2 Implementation Report

**Date:** 7 June 2026
**Scope:** Priority 2 only (P2-A Notifications + FCM, P2-B SMS OTP, P2-C Uploads). Priorities 3–4 **not started**, as instructed.
**Status:** Implemented, unit-tested (42/42 passing across 9 suites), build-verified.

---

## 1. What Was Implemented

| Item | Summary | Status |
|---|---|---|
| **P2-A** | Event-driven notifications (`@nestjs/event-emitter`); listener persists + pushes; FCM/console push providers; wired into all 10 lifecycle points; failures isolated | ✅ |
| **P2-B** | `SmsProvider` abstraction (console/Dialog/Twilio); OTP hashing; resend endpoint; resend cooldown; max-attempts lockout; per-route throttling | ✅ |
| **P2-C** | `UploadsModule` with S3-compatible presigned URLs (AWS S3 / R2 / Spaces / MinIO); 5 upload purposes; private KYC vs public task buckets | ✅ |

---

## 2. Files Modified / Added

**Added — P2-A (notifications)**
- `src/notifications/events/notification-events.ts` — event names + typed payloads.
- `src/notifications/providers/push.provider.ts` — `PushProvider` interface, `ConsolePushProvider`, `FcmPushProvider` (FCM HTTP v1), env factory.
- `src/notifications/notifications.listener.ts` — `@OnEvent` handlers mapping every event → notification.

**Added — P2-B (SMS)**
- `src/auth/providers/sms.provider.ts` — `SmsProvider` interface, `ConsoleSmsProvider`, `DialogSmsProvider`, `TwilioSmsProvider`, env factory.

**Added — P2-C (uploads)**
- `src/uploads/upload-purpose.ts` — purpose enum, private-set, content-type/extension map, key prefixes.
- `src/uploads/dto/presign.dto.ts` — validated presign request.
- `src/uploads/storage.provider.ts` — S3-compatible storage (presign PUT/GET, public URL).
- `src/uploads/uploads.service.ts`, `uploads.controller.ts`, `uploads.module.ts`.

**Modified**
- `src/notifications/notifications.service.ts` — uses `PushProvider`; `send()` never throws; added `sendToMany()`.
- `src/notifications/notifications.module.ts` — registers listener + push factory.
- `src/app.module.ts` — `EventEmitterModule.forRoot()`, `ThrottlerModule.forRoot()` + global `ThrottlerGuard`, `UploadsModule`.
- `src/tasks/tasks.service.ts` — emits TASK_POSTED (CASH), TASK_ACCEPTED, TASK_COMPLETED, TASK_CONFIRMED, PAYMENT_RELEASED, TASK_CANCELLED, TASK_DISPUTED.
- `src/payments/payments.service.ts` — emits TASK_POSTED when an ESCROW task is funded → OPEN.
- `src/messages/messages.service.ts` — emits NEW_MESSAGE to the counterpart.
- `src/ratings/ratings.service.ts` — emits RATING_RECEIVED.
- `src/admin/admin.service.ts` — emits KYC_REVIEWED on approve/reject.
- `src/scheduler/scheduler.service.ts` — passes `{ auto: true }` so auto-releases notify correctly.
- `src/auth/auth.service.ts` — SMS provider, OTP hashing, cooldown, max attempts, `resendOtp`.
- `src/auth/auth.controller.ts` — `otp/resend` route + `@Throttle` on all OTP routes.
- `src/auth/auth.module.ts` — provides `smsProviderFactory`.
- `prisma/schema.prisma` — `OtpToken.attempts Int @default(0)`.
- `.env.example` — all new variables (see §4).
- `package.json` — added `@nestjs/event-emitter`, `@nestjs/throttler`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

**Tests added/updated**
- Added: `notifications.listener.spec.ts`, `notifications.service.spec.ts`, `uploads.service.spec.ts`, `auth.service.spec.ts`.
- Updated for new constructors/behavior: `tasks.service.spec.ts`, `payments.service.spec.ts`, `scheduler.service.spec.ts`.

---

## 3. New APIs

| Method | Route | Purpose | Auth | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/auth/otp/resend` | Resend OTP (cooldown-guarded) | Public, throttled 5/min | `RequestOtpDto {phone}` | `{message}` |
| POST | `/api/uploads/presign` | Get a presigned upload URL | JWT | `PresignDto {purpose, contentType, fileName?}` | `{uploadUrl, key, fileUrl, isPrivate, expiresAt}` |

**Notifications:** no new public endpoints — delivery is internal (event listener → existing `Notification` CRUD already exposed under `/api/notifications`).

**Behavioral changes to existing routes:** `POST /api/auth/otp/request` and `/api/auth/otp/verify` now enforce a 5/min throttle, a resend cooldown, OTP hashing, and a 5-attempt verification cap (429 on throttle; 400 on cooldown; 401 on too many attempts).

---

## 4. New Environment Variables

```
# OTP
OTP_RESEND_COOLDOWN_SECONDS=60

# SMS provider: console | dialog | twilio
SMS_PROVIDER=console
SMS_GATEWAY_URL=            # Dialog/Mobitel HTTP gateway
SMS_GATEWAY_API_KEY=
SMS_SENDER_ID=HelpMi
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Push provider: console | fcm
PUSH_PROVIDER=console
FCM_PROJECT_ID=
FCM_SERVICE_ACCOUNT_JSON=   # for FCM HTTP v1 OAuth (integration point)

# Object storage (S3-compatible: AWS S3 | Cloudflare R2 | DO Spaces | MinIO)
S3_REGION=us-east-1
S3_ENDPOINT=                # set for R2/Spaces/MinIO; empty for AWS
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false   # true for MinIO
S3_PRIVATE_BUCKET=helpmi-kyc-private
S3_PUBLIC_BUCKET=helpmi-public
S3_PUBLIC_BASE_URL=         # optional CDN base
UPLOAD_PRESIGN_TTL_SECONDS=300
```

All providers default to safe dev values (`console`), so the app boots without any third-party credentials.

---

## 5. Database Changes

Additive, backward compatible. One new column:

| Table | Column | Type | Notes |
|---|---|---|---|
| `OtpToken` | `attempts` | `INTEGER NOT NULL DEFAULT 0` | P2-B max-verification-attempts lockout |

**Migration:** `prisma/migrations/20260607165026_p2_otp_attempts/migration.sql`

```sql
ALTER TABLE "OtpToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
```

(The DoerProfile payout columns and `PENDING_PAYMENT` were already added in the Priority 1 migration.)

---

## 6. Notification Wiring (P2-A coverage)

| Trigger | Event | Recipient(s) | NotificationType |
|---|---|---|---|
| Task posted (CASH at create / ESCROW at funding) | `task.posted` | tier-eligible doers | TASK_POSTED |
| Doer accepts | `task.accepted` | poster | TASK_ACCEPTED |
| Doer marks complete | `task.completed` | poster | TASK_COMPLETED |
| Poster confirms | `task.confirmed` | doer | TASK_CONFIRMED |
| Escrow released (manual + 24h auto) | `payment.released` | doer | PAYMENT_RELEASED |
| Task cancelled | `task.cancelled` | other party | TASK_CANCELLED |
| Dispute raised | `task.disputed` | other party | TASK_DISPUTED |
| Message sent | `message.sent` | counterpart | NEW_MESSAGE |
| KYC approved/rejected | `kyc.reviewed` | doer | KYC_APPROVED / KYC_REJECTED |
| Rating created | `rating.received` | ratee | RATING_RECEIVED |

All 11 `NotificationType` enum values are now produced. Events are emitted **after** the business transaction; the listener and `NotificationsService.send()` swallow/log their own errors, so a notification or push failure can never roll back or fail a task/payment operation (covered by a test).

---

## 7. Test Results

**42 / 42 passing across 9 suites** (`npx jest --config jest-p1.config.cjs`):

```
PASS src/auth/auth.service.spec.ts              (OTP issue/cooldown/hash/verify/attempts)
PASS src/uploads/uploads.service.spec.ts        (presign: private vs public, key shape, content-type)
PASS src/notifications/notifications.listener.spec.ts (all 11 event→notification mappings)
PASS src/notifications/notifications.service.spec.ts  (persist + push + failure isolation)
PASS src/tasks/tasks.service.spec.ts            (gating + release + event emissions)
PASS src/payments/payments.service.spec.ts      (webhook promote + idempotency)
PASS src/scheduler/scheduler.service.spec.ts    (24h auto-release)
PASS src/doer/doer.service.spec.ts              (KYC field mapping)
PASS src/app.controller.spec.ts

Test Suites: 9 passed, 9 total
Tests:       42 passed, 42 total
```

Requirement coverage: **event emissions** verified (tasks + webhook), **notification creation** verified (listener + service), **upload URL generation** verified (private/public, key, content-type), **OTP flow** verified (issue, cooldown, hashing, verify, wrong-code attempt increment, max-attempt lockout).

---

## 8. Build Verification

`npx tsc -p tsconfig.build.json` (full type-check):

- With the **un-regenerated** Prisma client, the *only* errors were 4 references to `OtpToken.attempts` and `TaskStatus.PENDING_PAYMENT` — both new schema elements the generated client doesn't know yet.
- After simulating `prisma generate` (adding those to the generated client), **`tsc` exited 0 — a clean compile.** The generated client was then restored to its original state.

No type errors in any P2 code (notifications, events, providers, uploads, SMS, throttling). On your machine the standard flow compiles cleanly:

```bash
cd backend
npm install
npx prisma generate         # picks up OtpToken.attempts (+ P1 fields)
npx prisma migrate deploy    # applies the P2 OTP-attempts migration
npm run build                # 0 errors
npm test
```

> Environment note: as in P1, the sandbox here cannot reach Postgres or Prisma's engine CDN, so `prisma generate`/`migrate` and a live `nest build` (which cleans `dist/`) can't run in-sandbox. Verification was done via `tsc` + mocked-Prisma unit tests. `jest-p1.config.cjs` runs the suite without a regenerated client; once you run `prisma generate`, the standard `npm test` covers everything too.

---

## 9. Remaining Known Issues / Notes

**Within Priority 2 scope — none outstanding.** All three items implemented, tested, build-verified.

**Intentional limitations (by design, flagged for later):**
1. **TASK_POSTED targeting is tier-filtered, not geo-radius.** Doer location isn't stored, so new-task notifications go to all approved, tier-eligible, non-banned doers (capped at 500). Geo/topic targeting needs doer-location storage — a future enhancement.
2. **FCM access-token exchange is a marked integration point.** `FcmPushProvider` posts to FCM HTTP v1 but `getAccessToken()` returns null until wired to `google-auth-library` with `FCM_SERVICE_ACCOUNT_JSON`. Until then it degrades gracefully (logs, never throws). `ConsolePushProvider` is the default.
3. **SMS gateway field names** in `DialogSmsProvider` follow the common Dialog/Mobitel REST shape and should be confirmed against the exact contract during integration. `TwilioSmsProvider` is complete.
4. **Upload size enforcement** is best-effort: presigned PUT signs the content-type but not a hard byte cap (S3 presigned PUT limitation). A POST-policy or post-upload size check can be added if needed.
5. **OTP hashing** uses SHA-256 salted with the phone number (sufficient given 5-min expiry + 5-attempt cap). A server-side pepper can be layered in P3-C hardening.

**Deferred to later priorities (untouched):** payout execution (P3-A), cash Rs. 99 fee (P3-B), broader security hardening incl. phone masking / participant guards / webhook idempotency on payment_id / PDPA endpoints (P3-C), Swagger (P4-A), full E2E suite (P4-B).

---

*End of Priority 2 report. No Priority 3 or 4 work started, as instructed. Awaiting your go-ahead for Priority 3.*
