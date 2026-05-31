import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUrl,
  IsIn,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(5)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photoUrls?: string[];

  @IsNumber()
  @Type(() => Number)
  locationLat: number;

  @IsNumber()
  @Type(() => Number)
  locationLng: number;

  @IsString()
  locationAddress: string;

  @IsNumber()
  @Min(500)
  @Type(() => Number)
  budget: number;

  @IsOptional()
  @IsIn(['ESCROW', 'CASH'])
  paymentMode?: 'ESCROW' | 'CASH';

  @IsOptional()
  @IsIn(['BRONZE', 'SILVER', 'GOLD'])
  requiredTier?: 'BRONZE' | 'SILVER' | 'GOLD';

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;
}
