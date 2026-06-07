-- Priority 2 (P2-B): track OTP verification attempts to enforce a max-attempts
-- lockout. Additive and backward compatible.

-- AlterTable
ALTER TABLE "OtpToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;
