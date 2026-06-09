/** P2-C: what an uploaded object is for — drives bucket choice + visibility. */
export enum UploadPurpose {
  KYC_NIC = 'KYC_NIC',
  KYC_SELFIE = 'KYC_SELFIE',
  // G-3: the remaining KYC artefacts get first-class private purposes so that
  // every document required by the tier table (address proof, police
  // clearance, driving licence, skill proof) can round-trip
  // presign → upload → submit → admin review.
  KYC_ADDRESS = 'KYC_ADDRESS',
  KYC_POLICE = 'KYC_POLICE',
  KYC_LICENSE = 'KYC_LICENSE',
  KYC_SKILL = 'KYC_SKILL',
  TASK_PHOTO = 'TASK_PHOTO',
  COMPLETION_PHOTO = 'COMPLETION_PHOTO',
  PROFILE_PHOTO = 'PROFILE_PHOTO',
}

/** KYC artefacts are sensitive (PDPA) and must live in the private bucket. */
export const PRIVATE_PURPOSES: ReadonlySet<UploadPurpose> = new Set([
  UploadPurpose.KYC_NIC,
  UploadPurpose.KYC_SELFIE,
  UploadPurpose.KYC_ADDRESS,
  UploadPurpose.KYC_POLICE,
  UploadPurpose.KYC_LICENSE,
  UploadPurpose.KYC_SKILL,
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
  [UploadPurpose.KYC_ADDRESS]: 'kyc/address',
  [UploadPurpose.KYC_POLICE]: 'kyc/police',
  [UploadPurpose.KYC_LICENSE]: 'kyc/license',
  [UploadPurpose.KYC_SKILL]: 'kyc/skill',
  [UploadPurpose.TASK_PHOTO]: 'tasks/photos',
  [UploadPurpose.COMPLETION_PHOTO]: 'tasks/completion',
  [UploadPurpose.PROFILE_PHOTO]: 'profiles',
};

// --- G-3: private KYC storage-key contract ---------------------------------
// Keys are minted exclusively by UploadsService.presign as
//   kyc/<subtype>/<userId>/<uuid>.<ext>
// Segments allow only [A-Za-z0-9-], so an anchored match excludes path
// traversal, nested paths, and any non-KYC private object by construction.

export type KycKeySubtype = 'nic' | 'selfie' | 'address' | 'police' | 'license' | 'skill';

const KEY_SEGMENT = '[A-Za-z0-9-]{1,64}';
const KEY_EXT = '(?:jpg|png|webp)';

/** Anchored pattern for one subtype, e.g. kyc/nic/<userId>/<uuid>.jpg */
export const kycKeyPattern = (subtype: KycKeySubtype): RegExp =>
  new RegExp(`^kyc/${subtype}/${KEY_SEGMENT}/${KEY_SEGMENT}\\.${KEY_EXT}$`);

/** Any well-formed private KYC key (all subtypes). */
export const ANY_KYC_KEY_PATTERN = new RegExp(
  `^kyc/(?:nic|selfie|address|police|license|skill)/${KEY_SEGMENT}/${KEY_SEGMENT}\\.${KEY_EXT}$`,
);

/** Defense-in-depth: the key's user segment must match the acting user. */
export const kycKeyBelongsTo = (key: string, userId: string): boolean =>
  ANY_KYC_KEY_PATTERN.test(key) && key.split('/')[2] === userId;
