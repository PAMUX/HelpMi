import { IsString, IsOptional, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { kycKeyPattern } from '../../uploads/upload-purpose.js';

const keyMessage = (subtype: string, purpose: string) =>
  `must be the private storage KEY returned by POST /uploads/presign (purpose ${purpose}), ` +
  `shaped kyc/${subtype}/<your-user-id>/<file>.<jpg|png|webp> — not a URL`;

/**
 * G-3: KYC documents are PRIVATE-bucket storage KEYS, not URLs.
 *
 * The presign endpoint returns { key, fileUrl: null } for private purposes and
 * documents "persist the key" — but this DTO previously enforced @IsUrl, which
 * made that contract impossible to satisfy and left admin review blind
 * (audit G-3). Field names keep their historical *Url suffix to avoid an API
 * and column rename; the stored value is now the key, and the admin endpoint
 * GET /admin/kyc/:id/documents turns keys back into short-TTL signed URLs.
 *
 * Breaking change for app builds that sent URLs — coordinate client update.
 */
export class SubmitKycDto {
  @ApiProperty({
    example: 'kyc/nic/4f9f6e0a-aaaa-bbbb-cccc-1234567890ab/0c1d2e3f-1111-2222-3333-445566778899.jpg',
    description: 'Storage key from presign purpose KYC_NIC',
  })
  @IsString()
  @Matches(kycKeyPattern('nic'), { message: `nicPhotoUrl ${keyMessage('nic', 'KYC_NIC')}` })
  nicPhotoUrl: string;

  @ApiProperty({ description: 'Storage key from presign purpose KYC_SELFIE' })
  @IsString()
  @Matches(kycKeyPattern('selfie'), { message: `selfieUrl ${keyMessage('selfie', 'KYC_SELFIE')}` })
  selfieUrl: string;

  @ApiProperty({ description: 'Storage key from presign purpose KYC_ADDRESS' })
  @IsString()
  @Matches(kycKeyPattern('address'), {
    message: `addressProofUrl ${keyMessage('address', 'KYC_ADDRESS')}`,
  })
  addressProofUrl: string;

  @ApiPropertyOptional({ description: 'Storage key from presign purpose KYC_POLICE (Silver+)' })
  @IsOptional()
  @Matches(kycKeyPattern('police'), {
    message: `policeClearanceUrl ${keyMessage('police', 'KYC_POLICE')}`,
  })
  policeClearanceUrl?: string;

  @ApiPropertyOptional({ description: 'Storage key from presign purpose KYC_LICENSE (Gold)' })
  @IsOptional()
  @Matches(kycKeyPattern('license'), {
    message: `drivingLicenseUrl ${keyMessage('license', 'KYC_LICENSE')}`,
  })
  drivingLicenseUrl?: string;

  @ApiPropertyOptional({ description: 'Storage key from presign purpose KYC_SKILL (Gold)' })
  @IsOptional()
  @Matches(kycKeyPattern('skill'), {
    message: `skillProofUrl ${keyMessage('skill', 'KYC_SKILL')}`,
  })
  skillProofUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ref1Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ref1Phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ref2Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ref2Phone?: string;

  // G-7A: BANK-only at launch (wallet payouts ship with G-7B).
  @ApiPropertyOptional({ enum: ['BANK'] })
  @IsOptional()
  @IsIn(['BANK'], { message: 'Mobile-wallet payouts are not available yet — use BANK' })
  preferredPayoutMethod?: 'BANK';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankBranch?: string;

  /** @deprecated G-7A: accepted but unused until wallet payouts ship. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  mobileWalletProvider?: string;

  /** @deprecated G-7A: accepted but unused until wallet payouts ship. */
  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsString()
  mobileWalletNumber?: string;
}
