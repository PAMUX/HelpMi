import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PayoutMethodDto } from './payout-method.dto';

/** G-7A: BANK-only at launch + complete-destination enforcement. */
describe('PayoutMethodDto (G-7A)', () => {
  const valid = {
    preferredPayoutMethod: 'BANK',
    bankAccountName: 'A. B. C. Perera',
    bankAccountNumber: '100254789632',
    bankName: 'Commercial Bank',
  };

  const errorsFor = (payload: object) =>
    validateSync(plainToInstance(PayoutMethodDto, payload)).map((e) => e.property);

  it('accepts a complete BANK destination', () => {
    expect(errorsFor(valid)).toEqual([]);
  });

  it('rejects MOBILE_WALLET until G-7B ships', () => {
    expect(errorsFor({ ...valid, preferredPayoutMethod: 'MOBILE_WALLET' })).toContain(
      'preferredPayoutMethod',
    );
  });

  it('requires the full bank destination (no unpayable null snapshots)', () => {
    expect(errorsFor({ preferredPayoutMethod: 'BANK' })).toEqual(
      expect.arrayContaining(['bankAccountName', 'bankAccountNumber', 'bankName']),
    );
  });

  it('rejects malformed account numbers', () => {
    expect(errorsFor({ ...valid, bankAccountNumber: '12AB34' })).toContain('bankAccountNumber');
    expect(errorsFor({ ...valid, bankAccountNumber: '123' })).toContain('bankAccountNumber');
  });

  it('still tolerates deprecated wallet fields from older app builds', () => {
    expect(
      errorsFor({ ...valid, mobileWalletProvider: 'FriMi', mobileWalletNumber: '0770000000' }),
    ).toEqual([]);
  });
});
