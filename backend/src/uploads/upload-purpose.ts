/** P2-C: what an uploaded object is for — drives bucket choice + visibility. */
export enum UploadPurpose {
  KYC_NIC = 'KYC_NIC',
  KYC_SELFIE = 'KYC_SELFIE',
  TASK_PHOTO = 'TASK_PHOTO',
  COMPLETION_PHOTO = 'COMPLETION_PHOTO',
  PROFILE_PHOTO = 'PROFILE_PHOTO',
}

/** KYC artefacts are sensitive (PDPA) and must live in the private bucket. */
export const PRIVATE_PURPOSES: ReadonlySet<UploadPurpose> = new Set([
  UploadPurpose.KYC_NIC,
  UploadPurpose.KYC_SELFIE,
]);

/** Allowed image content types and their file extensions. */
export const CONTENT_TYPE_EXT: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Storage key prefix per purpose. */
export const PURPOSE_PREFIX: Readonly<Record<UploadPurpose, string>> = {
  [UploadPurpose.KYC_NIC]: 'kyc/nic',
  [UploadPurpose.KYC_SELFIE]: 'kyc/selfie',
  [UploadPurpose.TASK_PHOTO]: 'tasks/photos',
  [UploadPurpose.COMPLETION_PHOTO]: 'tasks/completion',
  [UploadPurpose.PROFILE_PHOTO]: 'profiles',
};
