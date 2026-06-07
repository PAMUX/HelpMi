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
exports.PresignDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const upload_purpose_js_1 = require("../upload-purpose.js");
class PresignDto {
    purpose;
    contentType;
    fileName;
    static _OPENAPI_METADATA_FACTORY() {
        return { purpose: { required: true, enum: require("../upload-purpose").UploadPurpose }, contentType: { required: true, type: () => String, enum: Object.keys(upload_purpose_js_1.CONTENT_TYPE_EXT) }, fileName: { required: false, type: () => String, description: "Optional client-provided original filename (for reference only)." } };
    }
}
exports.PresignDto = PresignDto;
__decorate([
    (0, class_validator_1.IsEnum)(upload_purpose_js_1.UploadPurpose),
    __metadata("design:type", String)
], PresignDto.prototype, "purpose", void 0);
__decorate([
    (0, class_validator_1.IsIn)(Object.keys(upload_purpose_js_1.CONTENT_TYPE_EXT), {
        message: `contentType must be one of: ${Object.keys(upload_purpose_js_1.CONTENT_TYPE_EXT).join(', ')}`,
    }),
    __metadata("design:type", String)
], PresignDto.prototype, "contentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PresignDto.prototype, "fileName", void 0);
//# sourceMappingURL=presign.dto.js.map