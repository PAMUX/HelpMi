import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: '+94771234567' })
  @IsString()
  @Matches(/^\+94[0-9]{9}$/, { message: 'Phone must be a valid Sri Lanka number: +94XXXXXXXXX' })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit code' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  code: string;
}
