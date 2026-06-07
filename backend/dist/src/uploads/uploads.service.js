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
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const storage_provider_js_1 = require("./storage.provider.js");
const upload_purpose_js_1 = require("./upload-purpose.js");
let UploadsService = class UploadsService {
    storage;
    config;
    constructor(storage, config) {
        this.storage = storage;
        this.config = config;
    }
    presign(userId, dto) {
        const isPrivate = upload_purpose_js_1.PRIVATE_PURPOSES.has(dto.purpose);
        const bucket = this.storage.bucketFor(isPrivate);
        const ext = upload_purpose_js_1.CONTENT_TYPE_EXT[dto.contentType];
        const key = `${upload_purpose_js_1.PURPOSE_PREFIX[dto.purpose]}/${userId}/${(0, crypto_1.randomUUID)()}.${ext}`;
        const expiresIn = this.config.get('UPLOAD_PRESIGN_TTL_SECONDS') ?? 300;
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
        return this.storage
            .presignPut(bucket, key, dto.contentType, expiresIn)
            .then((uploadUrl) => ({
            uploadUrl,
            key,
            fileUrl: isPrivate ? null : this.storage.publicUrl(bucket, key),
            isPrivate,
            expiresAt,
        }));
    }
    presignRead(key) {
        const bucket = this.storage.bucketFor(true);
        const expiresIn = this.config.get('UPLOAD_PRESIGN_TTL_SECONDS') ?? 300;
        return this.storage.presignGet(bucket, key, expiresIn).then((url) => ({
            url,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        }));
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_provider_js_1.StorageProvider,
        config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map