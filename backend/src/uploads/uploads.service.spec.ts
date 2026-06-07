import { UploadsService } from './uploads.service';
import { UploadPurpose } from './upload-purpose';

// P2-C: presigned URL generation, bucket/visibility selection, key shape.

function buildStorage() {
  return {
    bucketFor: jest.fn((isPrivate: boolean) => (isPrivate ? 'priv' : 'pub')),
    presignPut: jest.fn().mockResolvedValue('https://signed.example/put'),
    presignGet: jest.fn().mockResolvedValue('https://signed.example/get'),
    publicUrl: jest.fn((bucket: string, key: string) => `https://cdn.example/${key}`),
  } as any;
}

function buildConfig() {
  return { get: jest.fn(() => 300) } as any;
}

describe('UploadsService.presign (P2-C)', () => {
  let storage: any;
  let service: UploadsService;

  beforeEach(() => {
    storage = buildStorage();
    service = new UploadsService(storage, buildConfig());
  });

  it('KYC selfie uses the PRIVATE bucket and returns no public fileUrl', async () => {
    const res = await service.presign('user1', {
      purpose: UploadPurpose.KYC_SELFIE,
      contentType: 'image/jpeg',
    } as any);

    expect(storage.bucketFor).toHaveBeenCalledWith(true);
    expect(res.isPrivate).toBe(true);
    expect(res.fileUrl).toBeNull();
    expect(res.key).toMatch(/^kyc\/selfie\/user1\/.+\.jpg$/);
    expect(res.uploadUrl).toBe('https://signed.example/put');
  });

  it('TASK_PHOTO uses the PUBLIC bucket and returns a public fileUrl', async () => {
    const res = await service.presign('user1', {
      purpose: UploadPurpose.TASK_PHOTO,
      contentType: 'image/png',
    } as any);

    expect(storage.bucketFor).toHaveBeenCalledWith(false);
    expect(res.isPrivate).toBe(false);
    expect(res.fileUrl).toContain('https://cdn.example/');
    expect(res.key).toMatch(/^tasks\/photos\/user1\/.+\.png$/);
  });

  it('signs the PUT with the requested content type', async () => {
    await service.presign('user1', {
      purpose: UploadPurpose.PROFILE_PHOTO,
      contentType: 'image/webp',
    } as any);
    expect(storage.presignPut).toHaveBeenCalledWith('pub', expect.any(String), 'image/webp', 300);
  });
});
