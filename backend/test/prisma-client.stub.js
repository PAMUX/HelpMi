// Test-only stub for @prisma/client (unit tests).
// Unit tests inject a mocked Prisma everywhere, so they never use a real
// client/engine — the only reason @prisma/client loads is that PrismaService
// does `extends PrismaClient`. This stub satisfies that without depending on
// where Prisma generated its client. NOT used by e2e (which needs the real DB).
class PrismaClient {
  $connect() { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  $on() {}
  $transaction(arg) {
    return typeof arg === 'function' ? arg(this) : Promise.all(arg);
  }
}

const DoerTier = { BRONZE: 'BRONZE', SILVER: 'SILVER', GOLD: 'GOLD' };
const KycStatus = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };
const TaskStatus = {
  OPEN: 'OPEN', ASSIGNED: 'ASSIGNED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED', DISPUTED: 'DISPUTED', PENDING_PAYMENT: 'PENDING_PAYMENT',
};
const PaymentMode = { ESCROW: 'ESCROW', CASH: 'CASH' };
const EscrowStatus = {
  PENDING: 'PENDING', HELD: 'HELD', RELEASED: 'RELEASED', REFUNDED: 'REFUNDED', DISPUTED: 'DISPUTED',
};
const PayoutMethod = { BANK: 'BANK', MOBILE_WALLET: 'MOBILE_WALLET' };
const PayoutStatus = { PENDING: 'PENDING', PROCESSING: 'PROCESSING', PAID: 'PAID', FAILED: 'FAILED' };
const PostingFeeStatus = { PENDING: 'PENDING', PAID: 'PAID', REFUNDED: 'REFUNDED' };
const DisputeStatus = { OPEN: 'OPEN', RESOLVED: 'RESOLVED', CLOSED: 'CLOSED' };
const MessageType = { TEXT: 'TEXT', IMAGE: 'IMAGE', SYSTEM: 'SYSTEM' };
const NotificationType = {
  TASK_POSTED: 'TASK_POSTED', TASK_ACCEPTED: 'TASK_ACCEPTED', TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CONFIRMED: 'TASK_CONFIRMED', TASK_CANCELLED: 'TASK_CANCELLED', TASK_DISPUTED: 'TASK_DISPUTED',
  NEW_MESSAGE: 'NEW_MESSAGE', PAYMENT_RELEASED: 'PAYMENT_RELEASED', KYC_APPROVED: 'KYC_APPROVED',
  KYC_REJECTED: 'KYC_REJECTED', RATING_RECEIVED: 'RATING_RECEIVED',
};

class Decimal {
  constructor(value) { this.value = value; }
  toString() { return String(this.value); }
  toNumber() { return Number(this.value); }
}
const Prisma = { Decimal };

module.exports = {
  PrismaClient, Prisma, Decimal,
  DoerTier, KycStatus, TaskStatus, PaymentMode, EscrowStatus,
  PayoutMethod, PayoutStatus, PostingFeeStatus, DisputeStatus, MessageType, NotificationType,
};
