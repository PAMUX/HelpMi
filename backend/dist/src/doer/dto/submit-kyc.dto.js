"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitKycDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class SubmitKycDto {
    nicPhotoUrl;
    selfieUrl;
    addressProofUrl;
    policeClearanceUrl;
    drivingLicenseUrl;
    skillProofUrl;
    ref1Name;
    ref1Phone;
    ref2Name;
    ref2Phone;
    preferredPayoutMethod;
    bankAccountName;
    bankAccountNumber;
    bankName;
    bankBranch;
    mobileWalletProvider;
    mobileWalletNumber;
    static _OPENAPI_METADATA_FACTORY() {
        return { nicPhotoUrl: { required: true, type: () => String, format: "uri" }, selfieUrl: { required: true, type: () => String, format: "uri" }, addressProofUrl: { required: true, type: () => String, format: "uri" }, policeClearanceUrl: { required: false, type: () => String, format: "uri" }, drivingLicenseUrl: { required: false, type: () => String, format: "uri" }, skillProofUrl: { required: false, type: () => String, format: "uri" }, ref1Name: { required: false, type: () => String }, ref1Phone: { required: false, type: () => String }, ref2Name: { required: false, type: () => String }, ref2Phone: { required: false, type: () => String }, preferredPayoutMethod: { required: false, enum: ["BANK", "MOBILE_WALLET"], enum: ['BANK', 'MOBILE_WALLET'] }, bankAccountName: { required: false, type: () => String }, bankAccountNumber: { required: false, type: () => String }, bankName: { required: false, type: () => String }, bankBranch: { required: false, type: () => String }, mobileWalletProvider: { required: false, type: () => String }, mobileWalletNumber: { required: false, type: () => String } };
    }
}
exports.SubmitKycDto = SubmitKycDto;
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "nicPhotoUrl", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "selfieUrl", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "addressProofUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "policeClearanceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "drivingLicenseUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "skillProofUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "ref1Name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "ref1Phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "ref2Name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "ref2Phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['BANK', 'MOBILE_WALLET']),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "preferredPayoutMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "bankAccountName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "bankAccountNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "bankName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "bankBranch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "mobileWalletProvider", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmitKycDto.prototype, "mobileWalletNumber", void 0);
//# sourceMappingURL=submit-kyc.dto.js.map