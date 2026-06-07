-- Priority 1 migration: payout columns on DoerProfile (P1-A) and the
-- PENDING_PAYMENT task status used to gate escrow funding (P1-B).
-- All changes are additive and backward compatible.

-- AlterEnum
-- Adds the pre-funding state. PostgreSQL 12+ permits ADD VALUE here because the
-- new value is not referenced within this same migration transaction.
ALTER TYPE "TaskStatus" ADD VALUE 'PENDING_PAYMENT';

-- AlterTable
ALTER TABLE "DoerProfile" ADD COLUMN     "preferredPayoutMethod" "PayoutMethod" NOT NULL DEFAULT 'BANK',
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankBranch" TEXT,
ADD COLUMN     "mobileWalletProvider" TEXT,
ADD COLUMN     "mobileWalletNumber" TEXT;
