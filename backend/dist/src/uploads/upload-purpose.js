"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PURPOSE_PREFIX = exports.CONTENT_TYPE_EXT = exports.PRIVATE_PURPOSES = exports.UploadPurpose = void 0;
var UploadPurpose;
(function (UploadPurpose) {
    UploadPurpose["KYC_NIC"] = "KYC_NIC";
    UploadPurpose["KYC_SELFIE"] = "KYC_SELFIE";
    UploadPurpose["TASK_PHOTO"] = "TASK_PHOTO";
    UploadPurpose["COMPLETION_PHOTO"] = "COMPLETION_PHOTO";
    UploadPurpose["PROFILE_PHOTO"] = "PROFILE_PHOTO";
})(UploadPurpose || (exports.UploadPurpose = UploadPurpose = {}));
exports.PRIVATE_PURPOSES = new Set([
    UploadPurpose.KYC_NIC,
    UploadPurpose.KYC_SELFIE,
]);
exports.CONTENT_TYPE_EXT = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
exports.PURPOSE_PREFIX = {
    [UploadPurpose.KYC_NIC]: 'kyc/nic',
    [UploadPurpose.KYC_SELFIE]: 'kyc/selfie',
    [UploadPurpose.TASK_PHOTO]: 'tasks/photos',
    [UploadPurpose.COMPLETION_PHOTO]: 'tasks/completion',
    [UploadPurpose.PROFILE_PHOTO]: 'profiles',
};
//# sourceMappingURL=upload-purpose.js.map