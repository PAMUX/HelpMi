import { IsIn, IsOptional, IsString } from 'class-validator';

export class PayoutMethodDto {
  @IsIn(['BANK', 'MOBILE_WALLET'])
  preferredPayoutMethod: 'BANK' | 'MOBILE_WALLET';

  @IsOptional() @IsString() bankAccountName?: string;
  @IsOptional() @IsString() bankAccountNumber?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() bankBranch?: string;
  @IsOptional() @IsString() mobileWalletProvider?: string;
  @IsOptional() @IsString() mobileWalletNumber?: string;
}
