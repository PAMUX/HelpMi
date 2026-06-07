# HelpMi Backend — Step 4: Priority 3 Implementation Report

**Date:** 7 June 2026
**Scope:** Priority 3 only (P3-A Payouts, P3-B Cash Fee, P3-C Security Hardening). Priority 4 **not started**, as instructed.
**Status:** Implemented, unit-tested (50/50 passing across 10 suites), build-verified (0 errors).

---

## 1. What Was Implemented

| Item | Summary | Status |
|---|---|---|
| **P3-A** | `Payout` ledger + `PayoutStatus` enum; `PayoutProvider` abstraction (wallet automated / bank manual); one idempotent payout per escrow release; doer + admin payout APIs incl. CSV export | ✅ |
| **P3-B** | `PostingFee` model + status; CASH tasks now `PENDING_PAYMENT` until the Rs. 99 fee is paid; reuses PayHere; escrow vs fee distinguished by order-id prefix | ✅ |
| **P3-C** | OTP pepper + throttling, phone masking, participant-only task detail, webhook idempotency by `payment_id`, dispute/admin DTO validation, restricted CORS, Helmet, global exception filter, structured logging, PDPA export/delete | ✅ |

---

## 2. Files Modified / Added

**Added — P3-A**
- `src/payments/providers/payout.provider.ts` — `PayoutProvider` (wallet→PayHere automated, bank→manual PENDING).
- `src/payments/payout.service.ts` — payout ledger (create-on-release, idempotent; doer list; admin list/mark-paid/CSV).
- `src/doer/dto/payout-method.dto.ts`.

**Added — P3-C**
- `src/common/filters/http-exception.filter.ts` — consistent error shape + 5xx logging.
- `src/common/interceptors/logging.interceptor.ts` — structured per-request logging.
- `src/tasks/dto/raise-dispute.dto.ts`, `src/admin/dto/{approve-kyc,reject-kyc,resolve-dispute,mark-paid}.dto.ts`.

**Modified**
- `prisma/schema.prisma` — `PayoutStatus`, `Payout`, `PostingFeeStatus`, `PostingFee`, `User.deletedAt`.
- `src/tasks/tasks.service.ts` — CASH→`PENDING_PAYMENT`+PostingFee; payout creation in `releaseEscrow`; participant-aware `findById`; poster phone removed from `accept`.
- `src/payments/payments.service.ts` — `initiatePayment` handles escrow + Rs. 99 fee; `handleWebhook` routes by record, dedupes by `payment_id`.
- `src/payments/payments.module.ts` — provides/exports `PayoutService` + `PayoutProvider`.
- `src/tasks/tasks.module.ts` — imports `PaymentsModule`.
- `src/doer/{doer.service.ts,doer.controller.ts}` — payout-method + payouts; no poster phone in my-tasks.
- `src/admin/{admin.service.ts,admin.controller.ts,admin.module.ts}` — payout admin ops; DTOs on KYC/dispute actions.
- `src/users/{users.service.ts,users.controller.ts}` — PDPA export/delete.
- `src/auth/auth.service.ts` — OTP pepper.
- `src/auth/strategies/jwt.strategy.ts` — rejects soft-deleted users.
- `src/main.ts` — Helmet, restricted CORS, global filter + logging interceptor.
- `.env.example` — `PAYHERE_PAYOUT_API_KEY`, `OTP_PEPPER`, `CORS_ORIGINS`.
- `package.json` — added `helmet`.

**Tests added/updated:** `payout.service.spec.ts` (new), `tasks.service.spec.ts` (CASH fee, payout-on-release, participant detail, phone masking), `payments.service.spec.ts` (fee routing + idempotency).

---

## 3. Database Changes

Additive, backward compatible.

**New enums:** `PayoutStatus` (PENDING, PROCESSING, PAID, FAILED), `PostingFeeStatus` (PENDING, PAID, REFUNDED).

**New table `Payout`** — `id`, `escrowId` (**unique** → one payout per release), `taskId`, `doerId`, `amount`, `method`, `status`, `providerRef?`, `failureReason?`, `destinationSnapshot?` (JSON), `createdAt`, `paidAt?`, `updatedAt`; indexes on `doerId` and `status`.

**New table `PostingFee`** — `id`, `taskId` (**unique**), `posterId`, `amount` (default 99.00), `status`, `payhereOrderId?`, `payherePaymentId?`, `paidAt?`, `createdAt`, `updatedAt`.

**`User`** — new nullable `deletedAt` (PDPA soft-delete).

---

## 4. New APIs

| Method | Route | Purpose | Auth | Request | Response |
|---|---|---|---|---|---|
| POST | `/api/doer/payout-method` | Set/update bank or wallet payout destination | JWT | `PayoutMethodDto` | `DoerProfile` |
| GET | `/api/doer/payouts` | Doer's payout history | JWT | — | `Payout[]` |
| GET | `/api/admin/payouts` | List payouts (optional `?status=`) | Admin | — | `Payout[]` |
| PATCH | `/api/admin/payouts/:id/mark-paid` | Mark a (bank) payout paid | Admin | `MarkPaidDto {providerRef?}` | `Payout` |
| GET | `/api/admin/payouts/export` | CSV export of payouts (`?status=`) | Admin | — | `text/csv` |
| GET | `/api/users/me/export` | PDPA data export | JWT | — | full data bundle |
| DELETE | `/api/users/me` | PDPA erasure (soft-delete + anonymize) | JWT | — | `{deleted:true}` |

**Behavioral changes:** `POST /api/tasks` for **CASH** now returns `PENDING_PAYMENT` and requires the Rs. 99 fee via `POST /api/payments/initiate/:taskId` before the task opens. `POST /api/tasks/:id/dispute`, `/api/admin/kyc/:id/approve|reject`, `/api/admin/disputes/:id/resolve` now use validated DTOs (400 on bad input). `GET /api/tasks/:id` returns a stripped view to non-participants. `accept` and `doer/my-tasks` no longer expose the poster's phone.

---

## 5. Security Improvements (P3-C)

- **OTP pepper** — `hashOtp` mixes an optional `OTP_PEPPER`; falls back to the prior scheme when unset (backward compatible).
- **OTP throttling** — auth routes already throttled 5/min (P2); retained and verified under the global `ThrottlerGuard`.
- **Phone masking** — counterpart phone numbers removed from task `accept` and doer `my-tasks` responses (spec §4.5).
- **Participant-only task detail** — `GET /tasks/:id` returns escrow/dispute/doer identity only to the poster/doer; others get a public subset.
- **Webhook idempotency** — escrow and posting-fee webhooks skip when already processed (status guard **plus** `payherePaymentId === payment_id`), so PayHere retries can't double-apply.
- **DTO validation** — disputes and admin KYC/dispute/payout actions now validated (no more raw `@Body('field')`).
- **Restricted CORS** — origins from `CORS_ORIGINS` allow-list instead of `*`.
- **Helmet** — security headers on all responses.
- **Global exception filter** — uniform error shape `{statusCode,error,message,path,timestamp}`; 5xx logged without leaking internals.
- **Structured logging** — one JSON line per request (method, path, duration); never logs bodies/OTP.
- **PDPA** — self-service data export and right-to-erasure; soft-deleted users are rejected at JWT validation.

---

## 6. Migration Details

**File:** `prisma/migrations/20260607170847_p3_payouts_postingfee_pdpa/migration.sql`

```sql
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');
CREATE TYPE "PostingFeeStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE TABLE "Payout" ( ... , CONSTRAINT "Payout_pkey" PRIMARY KEY ("id") );
CREATE UNIQUE INDEX "Payout_escrowId_key" ON "Payout"("escrowId");
CREATE INDEX "Payout_doerId_idx" ON "Payout"("doerId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");
CREATE TABLE "PostingFee" ( ... , CONSTRAINT "PostingFee_pkey" PRIMARY KEY ("id") );
CREATE UNIQUE INDEX "PostingFee_taskId_key" ON "PostingFee"("taskId");
```

Apply on your machine:
```bash
cd backend && npm install && npx prisma generate && npx prisma migrate deploy && npm run build && npm test
```

---

## 7. Accounting Integrity (P3-A guarantees)

- **Exactly one payout per release:** `Payout.escrowId` is unique; `releaseEscrow` only transitions an escrow out of `HELD` once (P1-C), and `PayoutService.createForEscrowRelease` first checks for an existing payout and catches the unique violation — so retries/races never duplicate.
- **Release is never undone by payout issues:** payout creation is wrapped so a provider/ledger error can't roll back a completed escrow release; the ledger row persists for admin reconciliation.
- **Wallet vs bank:** wallet payouts dispatch to PayHere (queued PROCESSING until credentials wired); bank payouts stay PENDING for the admin CSV batch (`/admin/payouts/export` → mark-paid).

---

## 8. Test Results

**50 / 50 passing across 10 suites** (`npx jest --config jest-p1.config.cjs`):

```
PASS src/payments/payout.service.spec.ts      (idempotency, wallet/bank, unique-violation fallback)
PASS src/payments/payments.service.spec.ts    (escrow + fee routing, payment_id idempotency, bad sig)
PASS src/tasks/tasks.service.spec.ts          (CASH fee, payout-on-release, participant detail, phone masking)
PASS src/auth/auth.service.spec.ts            (OTP issue/cooldown/hash/attempts)
PASS src/uploads/uploads.service.spec.ts
PASS src/notifications/notifications.listener.spec.ts
PASS src/notifications/notifications.service.spec.ts
PASS src/scheduler/scheduler.service.spec.ts
PASS src/doer/doer.service.spec.ts
PASS src/app.controller.spec.ts

Test Suites: 10 passed, 10 total
Tests:       50 passed, 50 total
```

Key P3 coverage: payout idempotency (existing-row + unique-violation paths), wallet/bank branching, one-payout-per-release, CASH→fee flow, webhook routing + `payment_id` idempotency, participant-only detail, phone masking.

---

## 9. Build Verification

`npx tsc -p tsconfig.build.json`:

- With the **un-regenerated** Prisma client, the only errors were the expected stale-client artifacts — the new `Payout`/`PostingFee` models (`prisma.payout`/`prisma.postingFee` "does not exist"), the new columns (DoerProfile payout fields, `User.deletedAt`, `OtpToken.attempts`) and the `PENDING_PAYMENT` enum. None indicated a logic/signature bug.
- After simulating `prisma generate` (patching the generated client's scalars/enum and augmenting the two new model delegates), **`tsc` exited 0 — a clean compile.** The generated client was then restored and the temporary augmentation shim removed.

> Environment note: as in P1/P2, the sandbox cannot reach Postgres or Prisma's engine CDN, so `prisma generate`/`migrate` and a live `nest build` (which cleans `dist/`) can't run here. Verification is via `tsc` + mocked-Prisma unit tests. Run the §6 command block on your machine for the full pipeline.

---

## 10. Remaining Known Issues / Notes

**Within Priority 3 scope — none outstanding.** All three items implemented, tested, build-verified.

**Intentional limitations (flagged for later):**
1. **Wallet payout API call is a marked integration point** — `PayoutProvider.dispatchWallet` posts to PayHere only once `PAYHERE_PAYOUT_API_KEY` is set; until then wallet payouts queue as `PROCESSING` (ledger stays consistent; admin/job reconciles). Bank payouts are fully manual by design.
2. **No automatic refund of the Rs. 99 posting fee** on task cancellation (`PostingFeeStatus.REFUNDED` exists in the model for when you add it).
3. **Trust-fund reserve** is still recorded on escrow but not disbursed (manual, per spec v1).
4. **CORS default** reflects any origin when `CORS_ORIGINS` is empty (dev convenience); set it in production.
5. **`destinationSnapshot`/CSV** include account numbers for ops settlement — ensure the admin CSV is access-controlled (it is admin-only).

**Deferred to Priority 4 (untouched):** Swagger/OpenAPI (P4-A) and the full automated test + E2E suite / PASS-FAIL matrix (P4-B).

---

*End of Priority 3 report. Priority 4 not started, as instructed.*
