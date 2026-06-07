import { IsIn } from 'class-validator';

export class ApproveKycDto {
  @IsIn(['BRONZE', 'SILVER', 'GOLD'])
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
}
