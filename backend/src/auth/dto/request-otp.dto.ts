import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: '+94771234567', description: 'Sri Lanka phone, +94XXXXXXXXX' })
  @IsString()
  @Matches(/^\+94[0-9]{9}$/, { message: 'Phone must be a valid Sri Lanka number: +94XXXXXXXXX' })
  phone: string;
}
