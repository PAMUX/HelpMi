import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+94[0-9]{9}$/, { message: 'Phone must be a valid Sri Lanka number: +94XXXXXXXXX' })
  phone: string;
}
