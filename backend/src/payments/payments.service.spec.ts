import { createHash } from 'crypto';
import { PaymentsService } from './payments.service';

const MERCHANT_ID = 'M1';
const MERCHANT_SECRET = 'S1';

function buildConfig(extra: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => {
      if (key in extra) return extra[key];
      if (key === 'PAYHERE_MERCHANT_ID') return MERCHANT_ID;
      if (key === 'PAYHERE_MERCHANT_SECRET') return MERCHANT_SECRET;
      if (key === 'PAYHERE_MODE') return 'sandbox';
      return undefined;
    }),
  } as any;
}

function buildPrismaMock() {
  return {
    escrow: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    postingFee: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
    task: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ id: 't1', posterId: 'p1', title: 'T', requiredTier: 'BRONZE' }),
    },
    $transaction: jest.fn().mockImplementation(async (arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg()),
  } as any;
}

function signedBody(overrides: Record<string, string> = {}) {
  const body: Record<string, string> = {
    merchant_id: MERCHANT_ID, order_id: 'HM-ABCD1234', payhere_amount: '2100.00',
    payhere_currency: 'LKR', status_code: '2', payment_id: 'PAY1', ...overrides,
  };
  const hashedSecret = createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
  body.md5sig = createHash('md5')
    .update(`${body.merchant_id}${body.order_id}${body.payhere_amount}${body.payhere_currency}${body.status_code}${hashedSecret}`)
    .digest('hex').toUpperCase();
  return body;
}

describe('PaymentsService.handleWebhook (P1-B/P3-B/P3-C)', () => {
  let prisma: any; let service: PaymentsService; let events: any;

  beforeEach(() => {
    prisma = buildPrismaMock();
    events = { emit: jest.fn() };
    service = new PaymentsService(prisma, buildConfig(), events);
  });

  it('escrow: holds + promotes PENDING_PAYMENT -> OPEN + announces', async () => {
    prisma.escrow.findFirst.mockResolvedValue({ id: 'e1', taskId: 't1', status: 'PENDING', payherePaymentId: null });
    await service.handleWebhook(signedBody({ order_id: 'HM-ABCD1234' }));
    expect(prisma.escrow.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'HELD', payherePaymentId: 'PAY1' }) }));
    expect(events.emit).toHaveBeenCalled();
  });

  it('escrow idempotency: same payment_id reprocessed is a no-op', async () => {
    prisma.escrow.findFirst.mockResolvedValue({ id: 'e1', taskId: 't1', status: 'PENDING', payherePaymentId: 'PAY1' });
    await service.handleWebhook(signedBody());
    expect(prisma.escrow.update).not.toHaveBeenCalled();
  });

  it('posting fee: routes by HMF- order, marks PAID, opens task, announces (P3-B)', async () => {
    prisma.escrow.findFirst.mockResolvedValue(null);
    prisma.postingFee.findFirst.mockResolvedValue({ id: 'f1', taskId: 't1', status: 'PENDING', payherePaymentId: null });
    await service.handleWebhook(signedBody({ order_id: 'HMF-ABCD1234' }));
    expect(prisma.postingFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PAID' }) }));
    expect(events.emit).toHaveBeenCalled();
  });

  it('rejects tampered signature', async () => {
    const bad = signedBody(); bad.md5sig = 'DEADBEEF';
    await expect(service.handleWebhook(bad)).rejects.toBeTruthy();
  });

  it('ignores non-success status codes', async () => {
    const res = await service.handleWebhook(signedBody({ status_code: '0' }));
    expect(res).toEqual({ received: true });
    expect(prisma.escrow.update).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.initiatePayment callback URLs (G-8)', () => {
  const BASE = 'https://staging.example.app';
  let prisma: any;

  const escrowTask = {
    id: 't1', posterId: 'p1', title: 'T', paymentMode: 'ESCROW',
    escrow: { status: 'PENDING', taskBudget: 2000, platformFeeFromPoster: 100 },
  };

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.task.findUnique = jest.fn().mockResolvedValue(escrowTask);
    prisma.postingFee.findUnique = jest.fn().mockResolvedValue({ status: 'PENDING', amount: 99 });
  });

  it('derives return/cancel/notify from APP_PUBLIC_BASE_URL (escrow branch)', async () => {
    const service = new PaymentsService(prisma, buildConfig({ APP_PUBLIC_BASE_URL: `${BASE}/` }), { emit: jest.fn() } as any);
    const res = await service.initiatePayment('t1', 'p1');
    expect(res.params.return_url).toBe(`${BASE}/payment/return`);
    expect(res.params.cancel_url).toBe(`${BASE}/payment/cancel`);
    expect(res.params.notify_url).toBe(`${BASE}/api/payments/webhook`);
    expect(res.params.order_id.startsWith('HM-')).toBe(true);
    expect(res.params.amount).toBe('2100.00');
  });

  it('derives URLs for the posting-fee branch too (HMF-)', async () => {
    prisma.task.findUnique = jest.fn().mockResolvedValue({ ...escrowTask, paymentMode: 'CASH', escrow: null });
    const service = new PaymentsService(prisma, buildConfig({ APP_PUBLIC_BASE_URL: BASE }), { emit: jest.fn() } as any);
    const res = await service.initiatePayment('t1', 'p1');
    expect(res.params.notify_url).toBe(`${BASE}/api/payments/webhook`);
    expect(res.params.order_id.startsWith('HMF-')).toBe(true);
    expect(res.params.amount).toBe('99.00');
  });

  it('explicit PAYHERE_*_URL overrides win over the derived URLs', async () => {
    const service = new PaymentsService(
      prisma,
      buildConfig({ APP_PUBLIC_BASE_URL: BASE, PAYHERE_NOTIFY_URL: 'https://hooks.example.app/ph' }),
      { emit: jest.fn() } as any,
    );
    const res = await service.initiatePayment('t1', 'p1');
    expect(res.params.notify_url).toBe('https://hooks.example.app/ph');
    expect(res.params.return_url).toBe(`${BASE}/payment/return`);
  });

  it('fails fast when no base URL or overrides are configured', async () => {
    const service = new PaymentsService(prisma, buildConfig(), { emit: jest.fn() } as any);
    await expect(service.initiatePayment('t1', 'p1')).rejects.toThrow(/APP_PUBLIC_BASE_URL/);
  });

  it('no hardcoded helpmi.lk anywhere in the payload', async () => {
    const service = new PaymentsService(prisma, buildConfig({ APP_PUBLIC_BASE_URL: BASE }), { emit: jest.fn() } as any);
    const res = await service.initiatePayment('t1', 'p1');
    expect(JSON.stringify(res)).not.toContain('helpmi.lk');
  });
});
