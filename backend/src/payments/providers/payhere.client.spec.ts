import { PayHereClient } from './payhere.client';

/** G-1: env-driven PayHere Merchant API client (sandbox→live = config only). */
function buildConfig(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) } as any;
}

const CREDS = { PAYHERE_APP_ID: 'app1', PAYHERE_APP_SECRET: 'secret1', PAYHERE_MODE: 'sandbox' };

describe('PayHereClient (G-1)', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  const tokenResponse = (token = 'tok1') => ({
    ok: true,
    json: async () => ({ access_token: token, expires_in: 600 }),
  });

  it('isConfigured reflects credential presence', () => {
    expect(new PayHereClient(buildConfig({})).isConfigured()).toBe(false);
    expect(new PayHereClient(buildConfig(CREDS)).isConfigured()).toBe(true);
  });

  it('uses the sandbox host in sandbox mode and the live host in live mode', async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: true, json: async () => ({ status: 1, data: { refund_id: 9 } }),
    });
    await new PayHereClient(buildConfig(CREDS)).refundPayment('PAY1', 'd');
    expect(fetchMock.mock.calls[0][0]).toContain('https://sandbox.payhere.lk/merchant/v1/oauth/token');
    expect(fetchMock.mock.calls[1][0]).toContain('https://sandbox.payhere.lk/merchant/v1/payment/refund');

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
      ok: true, json: async () => ({ status: 1, data: { refund_id: 9 } }),
    });
    await new PayHereClient(buildConfig({ ...CREDS, PAYHERE_MODE: 'live' })).refundPayment('PAY1', 'd');
    expect(fetchMock.mock.calls[0][0]).toContain('https://www.payhere.lk/merchant/v1/oauth/token');
  });

  it('caches the OAuth token across calls', async () => {
    const client = new PayHereClient(buildConfig(CREDS));
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 1, data: { refund_id: 1 } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 1, data: { refund_id: 2 } }) });

    await client.refundPayment('PAY1', 'd1');
    await client.refundPayment('PAY2', 'd2');

    // 3 calls total: 1 token + 2 refunds (token cached the second time)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('parses success (status 1) with provider ref', async () => {
    const client = new PayHereClient(buildConfig(CREDS));
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 1, data: { refund_id: 777 } }) });

    const res = await client.refundPayment('PAY1', 'desc');
    expect(res).toEqual({ success: true, providerRef: '777' });
    // refund body carries the payment id
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.payment_id).toBe('PAY1');
  });

  it('returns a clean failure on non-1 status and on transport errors (never throws)', async () => {
    const client = new PayHereClient(buildConfig(CREDS));
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: -1, msg: 'Already refunded' }) });
    expect(await client.refundPayment('PAY1', 'd')).toEqual({
      success: false, error: 'Already refunded',
    });

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await client.refundPayment('PAY1', 'd');
    expect(res.success).toBe(false);
    expect(res.error).toContain('ECONNREFUSED');
  });

  it('fails cleanly when the token endpoint rejects', async () => {
    const client = new PayHereClient(buildConfig(CREDS));
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    const res = await client.refundPayment('PAY1', 'd');
    expect(res.success).toBe(false);
    expect(res.error).toContain('401');
  });
});
