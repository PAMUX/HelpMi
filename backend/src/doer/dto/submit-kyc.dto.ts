import { IsString, IsOptional, IsUrl, IsIn } from 'class-validator';

export class SubmitKycDto {
  @IsUrl()
  nicPhotoUrl: string;

  @IsUrl()
  selfieUrl: string;

  @IsUrl()
  addressProofUrl: string;

  @IsOptional()
  @IsUrl()
  policeClearanceUrl?: string;

  @IsOptional()
  @IsUrl()
  drivingLicenseUrl?: string;

  @IsOptional()
  @IsUrl()
  skillProofUrl?: string;

  @IsOptional()
  @IsString()
  ref1Name?: string;

  @IsOptional()
  @IsString()
  ref1Phone?: string;

  @IsOptional()
  @IsString()
  ref2Name?: string;

  @IsOptional()
  @IsString()
  ref2Phone?: string;

  @IsOptional()
  @IsIn(['BANK', 'MOBILE_WALLET'])
  preferredPayoutMethod?: 'BANK' | 'MOBILE_WALLET';
}
