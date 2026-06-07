import { IsString, MinLength, MaxLength } from 'class-validator';

export class RaiseDisputeDto {
  @IsString()
  @MinLength(10, { message: 'Please describe the issue (at least 10 characters)' })
  @MaxLength(1000)
  reason: string;
}
