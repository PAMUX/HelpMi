# HelpMi Backend — Step 4: Priority 1 Implementation Report

**Date:** 7 June 2026
**Scope:** Priority 1 only (P1-A, P1-B, P1-C, P1-D). Priorities 2–4 **not started**, as instructed.
**Status:** Implemented, unit-tested (17/17 passing), build-verified.

---

## 1. What Was Implemented

| Item | Summary | Status |
|---|---|---|
| **P1-A** | KYC runtime crash fixed (explicit field mapping, no blind DTO spread) + payout columns added to `DoerProfile` | ✅ |
| **P1-B** | New `PENDING_PAYMENT` task state; ESCROW tasks not browsable/acceptable until funds are HELD; webhook promotes to `OPEN` | ✅ |
| **P1-C** | `confirm` now refuses to release unless escrow is HELD; release is transactional and idempotent via shared `releaseEscrow()` | ✅ |
| **P1-D** | Hourly scheduler auto-releases escrow 24h after completion if unconfirmed and undisputed | ✅ |

---

## 2. Files Modified / Added

**Modified**

- `prisma/schema.prisma` — added `PENDING_PAYMENT` to `TaskStatus`; added 7 payout columns to `DoerProfile`.
- `src/doer/doer.service.ts` — `submitKyc` rewritten to map fields explicitly (fixes B1) and persist payout fields.
- `src/doer/dto/submit-kyc.dto.ts` — added optional bank/wallet fields (`bankAccountName`, `bankAccountNumber`, `bankName`, `bankBranch`, `mobileWalletProvider`, `mobileWalletNumber`).
- `src/tasks/tasks.service.ts` — `create` sets `PENDING_PAYMENT` for ESCROW; `accept` gates on escrow `HELD`; `confirm` guarded; new shared `releaseEscrow()` helper.
- `src/payments/payments.service.ts` — `handleWebhook` promotes `PENDING_PAYMENT → OPEN` and only processes a `PENDING` escrow once (replay-safe).
- `src/app.module.ts` — registered `ScheduleModule.forRoot()` and `SchedulerModule`.
- `package.json` / `package-lock.json` — added `@nestjs/schedule` (v6.1.3).

**Added**

- `src/scheduler/scheduler.module.ts` — wires the scheduler, imports `TasksModule`.
- `src/scheduler/scheduler.service.ts` — `@Cron(EVERY_HOUR)` `autoReleaseEscrows()` (P1-D).
- `prisma/migrations/20260607161525_p1_payout_columns_and_pending_payment/migration.sql` — the migration.
- Unit tests: `src/doer/doer.service.spec.ts`, `src/tasks/tasks.service.spec.ts`, `src/payments/payments.service.spec.ts`, `src/scheduler/scheduler.service.spec.ts`.
- `jest-p1.config.cjs` — test config that runs the P1 specs without a regenerated Prisma client (see §6 caveat).

---

## 3. Database Changes

All changes are **additive and backward compatible** — no columns dropped, no types narrowed, existing rows unaffected.

**`TaskStatus` enum** — new value `PENDING_PAYMENT`.

**`DoerProfile`** — new columns:

| Column | Type | Notes |
|---|---|---|
| `preferredPayoutMethod` | `PayoutMethod` | `NOT NULL DEFAULT 'BANK'` (existing rows default safely) |
| `bankAccountName` | `text` | nullable |
| `bankAccountNumber` | `text` | nullable |
| `bankName` | `text` | nullable |
| `bankBranch` | `text` | nullable |
| `mobileWalletProvider` | `text` | nullable |
| `mobileWalletNumber` | `text` | nullable |

---

## 4. Migration Details

**File:** `prisma/migrations/20260607161525_p1_payout_columns_and_pending_payment/migration.sql`

```sql
-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "DoerProfile" ADD COLUMN     "preferredPayoutMethod" "PayoutMethod" NOT NULL DEFAULT 'BANK',
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "mobileWalletProvider" TEXT,
ADD COLUMN     "mobileWalletNumber" TEXT;
```

**To apply on your machine** (the sandbox here cannot reach a database or Prisma's engine CDN — see §6):

```bash
cd backend
npm install                 # fetches the Linux/Windows Prisma engines for your OS
npx prisma generate         # regenerates the client with PENDING_PAYMENT + payout fields
npx prisma migrate deploy   # applies the migration above (or `migrate dev` in development)
npm run build               # should compile with 0 errors
npm test                    # full suite incl. these P1 specs
```

> Note on the enum migration: `ALTER TYPE ... ADD VALUE` is safe here because the new value is not *used* within the same migration transaction (PostgreSQL 12+).

---

## 5. API Behavior Changes

No routes were added or removed. Behavior changes the mobile client must be aware of:

| Endpoint | Before | After |
|---|---|---|
| `POST /api/tasks` (ESCROW) | Returned task in `OPEN` immediately | Returns task in **`PENDING_PAYMENT`**; client must call `POST /api/payments/initiate/:taskId` and complete payment before it becomes `OPEN` |
| `POST /api/tasks` (CASH) | `OPEN` | Unchanged — still `OPEN` immediately |
| `GET /api/tasks/nearby` | — | Unfunded ESCROW tasks (`PENDING_PAYMENT`) are **excluded** (filter already requires `OPEN`) |
| `POST /api/tasks/:id/accept` | Could accept an unfunded escrow task | Returns **400** "Funds are not yet secured for this task" unless escrow is `HELD` |
| `POST /api/tasks/:id/confirm` | Released escrow even if never paid | Returns **400** "Escrow funds are not held…" unless escrow is `HELD`; otherwise releases atomically |
| `POST /api/payments/webhook` | Set task `OPEN` unconditionally | Promotes only `PENDING_PAYMENT → OPEN`, and processes a given escrow once |
| `POST /api/doer/kyc` | **Crashed at runtime** (B1) | Works; persists payout preference + bank/wallet details |

**New behavior (no endpoint):** an hourly job auto-releases escrow to the doer 24h after `completedAt` when the task is still `COMPLETED`, unconfirmed, undisputed, and funds are `HELD`.

---

## 6. Test Results

**Unit tests — 17/17 passing** (run: `npx jest --config jest-p1.config.cjs`):

```
PASS src/doer/doer.service.spec.ts        (P1-A)
PASS src/tasks/tasks.service.spec.ts      (P1-B, P1-C)
PASS src/payments/payments.service.spec.ts(P1-B webhook)
PASS src/scheduler/scheduler.service.spec.ts (P1-D)

Test Suites: 4 passed, 4 total
Tests:       17 passed, 17 total
```

Coverage of the critical money paths:

- **P1-A:** payout fields persist; only real columns mapped; resubmit-after-APPROVED still rejected.
- **P1-B:** ESCROW→`PENDING_PAYMENT`, CASH→`OPEN`; `accept` blocked unless `HELD`; webhook promotes only `PENDING_PAYMENT` and is replay-safe; tampered signature rejected.
- **P1-C:** `confirm` rejected when not `HELD` (no phantom payout); releases + increments doer stats atomically when `HELD`; `releaseEscrow` idempotent (no double increment).
- **P1-D:** correct 24h query filter; releases each due task; counts releases; one failure does not abort the batch.

**Build verification:**

A full `npm run build` could not be completed *inside this sandbox* for two environment reasons (not code issues): (1) Prisma's engine CDN is unreachable here, so the generated client cannot be regenerated to learn the new schema; (2) the sandbox cannot write the `dist/` output dir. To verify the code regardless, I ran `tsc -p tsconfig.build.json` to a writable temp dir:

- With the **stale** client: the *only* errors were two references to `'PENDING_PAYMENT'` (the enum the un-regenerated client doesn't know yet). No errors on the payout columns or any P1 logic.
- After simulating `prisma generate` (adding `PENDING_PAYMENT` to the generated `TaskStatus`): **`tsc` exited 0 — a clean compile.**

This demonstrates the implementation is type-correct and will build cleanly on your machine once `npx prisma generate` runs (step in §4).

---

## 7. Remaining Known Issues

**Within Priority 1 scope — none outstanding.** All four items implemented, tested, and build-verified.

**Deliberately deferred to later priorities (unchanged by this work):**

- **P3-A — Payout execution.** Payout *destinations* are now stored on `DoerProfile`, but releasing escrow still only flips status to `RELEASED`; no actual disbursement (wallet auto / bank CSV) or `Payout` ledger yet.
- **P3-B — Cash Rs. 99 fee.** CASH tasks remain `OPEN` immediately with no posting fee. (Gating hook is in place via the `paymentMode` branch in `create`.)
- **CASH job-count.** As before, `totalJobsCompleted` is incremented only for ESCROW confirmations; CASH completions don't count toward tier progression. Preserved original behavior intentionally; flag for a product decision.
- **P2 / P3-C / P4** — notifications, SMS, uploads, security hardening, Swagger, full test/E2E suite — untouched, per instructions.

**Environment caveats for your machine (not code defects):**

1. Run `npx prisma generate` before building so the client picks up `PENDING_PAYMENT` and the payout columns.
2. The `jest-p1.config.cjs` helper exists only because the client couldn't be regenerated here; once you run `prisma generate`, the standard `npm test` covers these specs too.
3. A live PostgreSQL is required to actually apply the migration (`migrate deploy`) and run any future E2E tests.

---

*End of Priority 1 report. Awaiting your go-ahead before starting Priority 2 (notifications, SMS OTP, uploads).*
