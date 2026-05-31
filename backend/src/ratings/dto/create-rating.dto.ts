import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRatingDto {
  @IsString()
  taskId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  score: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  isOnTime?: boolean;
}
