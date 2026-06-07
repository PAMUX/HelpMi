export declare class PayoutMethodDto {
    preferredPayoutMethod: 'BANK' | 'MOBILE_WALLET';
    bankAccountName?: string;
    bankAccountNumber?: string;
    bankName?: string;
    bankBranch?: string;
    mobileWalletProvider?: string;
    mobileWalletNumber?: string;
}
