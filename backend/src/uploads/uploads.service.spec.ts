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

  it('G-3: new KYC purposes (address/police/license/skill) are private', async () => {
    for (const purpose of [
      UploadPurpose.KYC_ADDRESS,
      UploadPurpose.KYC_POLICE,
      UploadPurpose.KYC_LICENSE,
      UploadPurpose.KYC_SKILL,
    ]) {
      const res = await service.presign('user1', { purpose, contentType: 'image/jpeg' } as any);
      expect(res.isPrivate).toBe(true);
      expect(res.fileUrl).toBeNull();
    }
  });
});

describe('UploadsService.presignRead (G-3 key scoping)', () => {
  let storage: any;
  let service: UploadsService;

  beforeEach(() => {
    storage = buildStorage();
    service = new UploadsService(storage, buildConfig());
  });

  it('signs a GET against the private bucket for a well-formed KYC key', async () => {
    const res = await service.presignRead('kyc/nic/user1/abc-123.jpg');
    expect(storage.bucketFor).toHaveBeenCalledWith(true);
    expect(storage.presignGet).toHaveBeenCalledWith('priv', 'kyc/nic/user1/abc-123.jpg', 300);
    expect(res.url).toBe('https://signed.example/get');
  });

  it('rejects traversal, URLs, non-KYC prefixes and bad extensions', async () => {
    const bad = [
      '../../etc/passwd',
      'kyc/nic/user1/../../secret.jpg',
      'kyc/nic/user1/file.exe',
      'tasks/photos/user1/a.jpg',
      'https://evil.example/kyc/nic/u/a.jpg',
      'kyc/unknown/user1/a.jpg',
      '',
    ];
    for (const key of bad) {
      await expect(service.presignRead(key)).rejects.toBeTruthy();
    }
    expect(storage.presignGet).not.toHaveBeenCalled();
  });
});
