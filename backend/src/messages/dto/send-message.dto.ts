import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  content: string;

  @IsOptional()
  @IsIn(['TEXT', 'IMAGE'])
  type?: 'TEXT' | 'IMAGE';
}
