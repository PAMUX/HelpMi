import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * G-7A (launch scope): payouts are BANK-only until the PayHere wallet payout
 * integration ships (G-7B). MOBILE_WALLET is rejected at the API edge, and the
 * bank destination must be complete — this endpoint is the canonical place a
 * doer sets where their money goes, so a half-empty destination is an error,
 * not a default (closes the audit's "unpayable null-destination payout" gap).
 *
 * The mobileWallet* fields are retained (optional, stored, unused) so existing
 * app builds that still send them don't trip forbidNonWhitelisted.
 */
export class PayoutMethodDto {
  @ApiProperty({ enum: ['BANK'], description: 'Mobile-wallet payouts launch later (G-7B)' })
  @IsIn(['BANK'], { message: 'Mobile-wallet payouts are not available yet — use BANK' })
  preferredPayoutMethod: 'BANK';

  @ApiProperty({ example: 'A. B. C. Perera' })
  @IsString()
  @MinLength(2)
  bankAccountName: string;

  @ApiProperty({ example: '100254789632', description: '6–18 digits' })
  @IsString()
  @Matches(/^[0-9]{6,18}$/, { message: 'bankAccountNumber must be 6–18 digits' })
  bankAccountNumber: string;

  @ApiProperty({ example: 'Commercial Bank' })
  @IsString()
  @MinLength(2)
  bankName: string;

  @ApiPropertyOptional({ example: 'Nugegoda' })
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
