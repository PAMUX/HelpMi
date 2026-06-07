import { UploadPurpose } from '../upload-purpose.js';
export declare class PresignDto {
    purpose: UploadPurpose;
    contentType: string;
    fileName?: string;
}
