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
exports.PayoutMethodDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class PayoutMethodDto {
    preferredPayoutMethod;
    bankAccountName;
    bankAccountNumber;
    bankName;
    bankBranch;
    mobileWalletProvider;
    mobileWalletNumber;
    static _OPENAPI_METADATA_FACTORY() {
        return { preferredPayoutMethod: { required: true, enum: ["BANK", "MOBILE_WALLET"], enum: ['BANK', 'MOBILE_WALLET'] }, bankAccountName: { required: false, type: () => String }, bankAccountNumber: { required: false, type: () => String }, bankName: { required: false, type: () => String }, bankBranch: { required: false, type: () => String }, mobileWalletProvider: { required: false, type: () => String }, mobileWalletNumber: { required: false, type: () => String } };
    }
}
exports.PayoutMethodDto = PayoutMethodDto;
__decorate([
    (0, class_validator_1.IsIn)(['BANK', 'MOBILE_WALLET']),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "preferredPayoutMethod", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "bankAccountName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "bankAccountNumber", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "bankName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "bankBranch", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "mobileWalletProvider", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PayoutMethodDto.prototype, "mobileWalletNumber", void 0);
//# sourceMappingURL=payout-method.dto.js.map