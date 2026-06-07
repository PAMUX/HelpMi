import { IsString, MinLength } from 'class-validator';

export class RejectKycDto {
  @IsString()
  @MinLength(3, { message: 'A rejection note is required' })
  note: string;
}
