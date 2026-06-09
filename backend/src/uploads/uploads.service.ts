import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { StorageProvider } from './storage.provider.js';
import { PresignDto } from './dto/presign.dto.js';
import {
  ANY_KYC_KEY_PATTERN,
  CONTENT_TYPE_EXT,
  PRIVATE_PURPOSES,
  PURPOSE_PREFIX,
} from './upload-purpose.js';

export interface PresignResult {
  /** PUT here with the exact Content-Type to upload the file. */
  uploadUrl: string;
  /** Object key to persist on the related entity (KYC/task/etc.). */
  key: string;
  /** Public URL for public objects; null for private (KYC) objects. */
  fileUrl: string | null;
  isPrivate: boolean;
  expiresAt: string;
}

@Injectable()
export class UploadsService {
  constructor(
    private storage: StorageProvider,
    private config: ConfigService,
  ) {}

  presign(userId: string, dto: PresignDto): Promise<PresignResult> {
    const isPrivate = PRIVATE_PURPOSES.has(dto.purpose);
    const bucket = this.storage.bucketFor(isPrivate);
    const ext = CONTENT_TYPE_EXT[dto.contentType];
    const key = `${PURPOSE_PREFIX[dto.purpose]}/${userId}/${randomUUID()}.${ext}`;

    const expiresIn = this.config.get<number>('UPLOAD_PRESIGN_TTL_SECONDS') ?? 300;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return this.storage
      .presignPut(bucket, key, dto.contentType, expiresIn)
      .then((uploadUrl) => ({
        uploadUrl,
        key,
        fileUrl: isPrivate ? null : this.storage.publicUrl(bucket, key),
        isPrivate,
        expiresAt,
      }));
  }

  /** Presigned read URL for a private object (e.g. admin reviewing KYC). */
  async presignRead(key: string): Promise<{ url: string; expiresAt: string }> {
    // G-3: only well-formed private KYC keys are readable through this path.
    // The anchored pattern excludes path traversal and any non-KYC object in
    // the private bucket by construction.
    if (!ANY_KYC_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Invalid KYC document key');
    }
    const bucket = this.storage.bucketFor(true);
    const expiresIn = this.config.get<number>('UPLOAD_PRESIGN_TTL_SECONDS') ?? 300;
    return this.storage.presignGet(bucket, key, expiresIn).then((url) => ({
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    }));
  }
}
