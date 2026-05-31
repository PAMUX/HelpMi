import { IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+94[0-9]{9}$/, { message: 'Phone must be a valid Sri Lanka number: +94XXXXXXXXX' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  code: string;
}
