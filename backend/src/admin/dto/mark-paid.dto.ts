import { IsOptional, IsString } from 'class-validator';

export class MarkPaidDto {
  @IsOptional()
  @IsString()
  providerRef?: string;
}
