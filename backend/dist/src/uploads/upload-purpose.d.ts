export declare enum UploadPurpose {
    KYC_NIC = "KYC_NIC",
    KYC_SELFIE = "KYC_SELFIE",
    TASK_PHOTO = "TASK_PHOTO",
    COMPLETION_PHOTO = "COMPLETION_PHOTO",
    PROFILE_PHOTO = "PROFILE_PHOTO"
}
export declare const PRIVATE_PURPOSES: ReadonlySet<UploadPurpose>;
export declare const CONTENT_TYPE_EXT: Readonly<Record<string, string>>;
export declare const PURPOSE_PREFIX: Readonly<Record<UploadPurpose, string>>;
