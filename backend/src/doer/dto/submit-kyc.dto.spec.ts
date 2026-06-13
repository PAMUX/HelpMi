import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SubmitKycDto } from './submit-kyc.dto';

/**
 * G-3: KYC documents must be private storage KEYS (presign contract), never
 * URLs; G-7A: payout method restricted to BANK.
 */
describe('SubmitKycDto (G-3 key contract)', () => {
  const user = '4f9f6e0a-aaaa-bbbb-cccc-1234567890ab';
  const valid = {
    nicPhotoUrl: `kyc/nic/${user}/0c1d2e3f-1111-2222-3333-445566778899.jpg`,
    selfieUrl: `kyc/selfie/${user}/1c1d2e3f-1111-2222-3333-445566778899.png`,
    addressProofUrl: `kyc/address/${user}/2c1d2e3f-1111-2222-3333-445566778899.webp`,
  };

  const errorsFor = (payload: object) =>
    validateSync(plainToInstance(SubmitKycDto, payload)).map((e) => e.property);

  it('accepts well-formed private storage keys', () => {
    expect(errorsFor(valid)).toEqual([]);
  });

  it('accepts optional Silver/Gold document keys with the right subtypes', () => {
    expect(
      errorsFor({
        ...valid,
        policeClearanceUrl: `kyc/police/${user}/3c1d.jpg`,
        drivingLicenseUrl: `kyc/license/${user}/4c1d.jpg`,
        skillProofUrl: `kyc/skill/${user}/5c1d.jpg`,
      }),
    ).toEqual([]);
  });

  it('rejects URLs (the pre-G-3 contract that broke admin review)', () => {
    expect(errorsFor({ ...valid, nicPhotoUrl: 'https://cdn.helpmi.lk/nic.jpg' })).toContain(
      'nicPhotoUrl',
    );
  });

  it('rejects path traversal and malformed keys', () => {
    expect(errorsFor({ ...valid, selfieUrl: 'kyc/selfie/../../etc/passwd' })).toContain('selfieUrl');
    expect(errorsFor({ ...valid, selfieUrl: `kyc/selfie/${user}/a.exe` })).toContain('selfieUrl');
    expect(errorsFor({ ...valid, selfieUrl: `kyc/selfie/${user}/a/b.jpg` })).toContain('selfieUrl');
  });

  it('rejects a key whose subtype does not match the field', () => {
    expect(errorsFor({ ...valid, nicPhotoUrl: valid.selfieUrl })).toContain('nicPhotoUrl');
  });

  it('G-7A: rejects MOBILE_WALLET payout preference', () => {
    expect(errorsFor({ ...valid, preferredPayoutMethod: 'MOBILE_WALLET' })).toContain(
      'preferredPayoutMethod',
    );
    expect(errorsFor({ ...valid, preferredPayoutMethod: 'BANK' })).toEqual([]);
  });
});
