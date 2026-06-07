import { IsBoolean, IsString, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  @MinLength(3)
  resolutionNote: string;

  @IsBoolean()
  refundPoster: boolean;
}
