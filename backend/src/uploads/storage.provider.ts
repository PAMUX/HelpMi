import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * P2-C: S3-compatible storage. A single S3 client serves AWS S3, Cloudflare R2,
 * DigitalOcean Spaces and MinIO — they all speak the S3 API. Differences are
 * env-driven:
 *   - AWS S3:   S3_REGION (+ default endpoint)
 *   - R2:       S3_ENDPOINT=https://<acct>.r2.cloudflarestorage.com, S3_REGION=auto
 *   - Spaces:   S3_ENDPOINT=https://<region>.digitaloceanspaces.com
 *   - MinIO:    S3_ENDPOINT=http://host:9000, S3_FORCE_PATH_STYLE=true
 */
@Injectable()
export class StorageProvider {
  private readonly logger = new Logger('StorageProvider');
  private client: S3Client | null = null;

  constructor(private config: ConfigService) {}

  private getClient(): S3Client {
    if (this.client) return this.client;

    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    const endpoint = this.config.get<string>('S3_ENDPOINT'); // optional (R2/Spaces/MinIO)
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    const forcePathStyle =
      (this.config.get<string>('S3_FORCE_PATH_STYLE') ?? 'false').toLowerCase() === 'true';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Object storage not configured (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)');
    }

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  bucketFor(isPrivate: boolean): string {
    const key = isPrivate ? 'S3_PRIVATE_BUCKET' : 'S3_PUBLIC_BUCKET';
    const bucket = this.config.get<string>(key);
    if (!bucket) throw new Error(`Missing ${key} configuration`);
    return bucket;
  }

  /** Presigned PUT URL for a direct browser/app upload. */
  presignPut(
    bucket: string,
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
    return getSignedUrl(this.getClient(), cmd, { expiresIn: expiresInSeconds });
  }

  /** Presigned GET URL for reading a private object (e.g. admin KYC review). */
  presignGet(bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(this.getClient(), cmd, { expiresIn: expiresInSeconds });
  }

  /** Stable public URL for a public-bucket object. */
  publicUrl(bucket: string, key: string): string {
    const base = this.config.get<string>('S3_PUBLIC_BASE_URL');
    if (base) return `${base.replace(/\/$/, '')}/${key}`;
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    if (endpoint) return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    const region = this.config.get<string>('S3_REGION') ?? 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
