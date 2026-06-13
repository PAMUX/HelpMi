-- Sprint 2 (G-1 / G-2): real refund lifecycle + cancel/webhook race protection.
-- All changes are additive and backward compatible.

-- AlterEnum (G-1): escrow state between "refund decided" and "provider
-- confirmed the money moved". PostgreSQL 12+ permits ADD VALUE here because
-- the new value is not referenced within this same migration transaction
-- (same pattern as the P1 migration).
ALTER TYPE "EscrowStatus" ADD VALUE 'REFUND_PENDING';

-- CreateEnum (G-1)
CREATE TYPE "RefundReason" AS ENUM ('CANCEL', 'DISPUTE', 'ADMIN');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable (G-1): refund ledger — one refund per escrow, FK-enforced
-- (deliberately unlike Payout/PostingFee, which the audit flagged as FK-less).
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "initiatedBy" TEXT NOT NULL,
    "lastAttemptedBy" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (G-1)
CREATE UNIQUE INDEX "Refund_escrowId_key" ON "Refund"("escrowId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "Refund_taskId_idx" ON "Refund"("taskId");

-- AddForeignKey (G-1)
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Riders (G-2 / audit B7-4): webhook order-routing integrity + the indexes the
-- recovery sweep and admin task/escrow filters rely on. Order ids are also
-- switched to full-task-UUID format in code, eliminating 8-hex-prefix
-- collisions; these unique indexes make any residual collision loud instead
-- of silently mis-routing money.
CREATE UNIQUE INDEX "Escrow_payhereOrderId_key" ON "Escrow"("payhereOrderId");
CREATE UNIQUE INDEX "PostingFee_payhereOrderId_key" ON "PostingFee"("payhereOrderId");
CREATE INDEX "Escrow_status_idx" ON "Escrow"("status");
CREATE INDEX "Task_status_idx" ON "Task"("status");
