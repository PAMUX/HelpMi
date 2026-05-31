import { IsString, IsEmail, IsOptional, IsUrl, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isDoer?: boolean;

  @IsOptional()
  @IsString()
  fcmToken?: string;
}
