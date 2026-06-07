-- Priority 3 migration. Additive and backward compatible.

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PostingFeeStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- AlterTable (P3-C PDPA soft delete)
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateTable Payout (P3-A)
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "doerId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "destinationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_escrowId_key" ON "Payout"("escrowId");
CREATE INDEX "Payout_doerId_idx" ON "Payout"("doerId");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateTable PostingFee (P3-B)
CREATE TABLE "PostingFee" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "posterId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 99.00,
    "status" "PostingFeeStatus" NOT NULL DEFAULT 'PENDING',
    "payhereOrderId" TEXT,
    "payherePaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostingFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostingFee_taskId_key" ON "PostingFee"("taskId");
