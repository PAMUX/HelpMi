import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { UploadPurpose, CONTENT_TYPE_EXT } from '../upload-purpose.js';

export class PresignDto {
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;

  @IsIn(Object.keys(CONTENT_TYPE_EXT), {
    message: `contentType must be one of: ${Object.keys(CONTENT_TYPE_EXT).join(', ')}`,
  })
  contentType: string;

  /** Optional client-provided original filename (for reference only). */
  @IsOptional()
  @IsString()
  fileName?: string;
}
