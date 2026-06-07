export declare class SubmitKycDto {
    nicPhotoUrl: string;
    selfieUrl: string;
    addressProofUrl: string;
    policeClearanceUrl?: string;
    drivingLicenseUrl?: string;
    skillProofUrl?: string;
    ref1Name?: string;
    ref1Phone?: string;
    ref2Name?: string;
    ref2Phone?: string;
    preferredPayoutMethod?: 'BANK' | 'MOBILE_WALLET';
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankName?: string;
    bankBranch?: string;
    mobileWalletProvider?: string;
    mobileWalletNumber?: string;
}
