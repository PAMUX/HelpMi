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
exports.StorageProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
let StorageProvider = class StorageProvider {
    config;
    logger = new common_1.Logger('StorageProvider');
    client = null;
    constructor(config) {
        this.config = config;
    }
    getClient() {
        if (this.client)
            return this.client;
        const region = this.config.get('S3_REGION') ?? 'us-east-1';
        const endpoint = this.config.get('S3_ENDPOINT');
        const accessKeyId = this.config.get('S3_ACCESS_KEY_ID');
        const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY');
        const forcePathStyle = (this.config.get('S3_FORCE_PATH_STYLE') ?? 'false').toLowerCase() === 'true';
        if (!accessKeyId || !secretAccessKey) {
            throw new Error('Object storage not configured (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)');
        }
        this.client = new client_s3_1.S3Client({
            region,
            ...(endpoint ? { endpoint } : {}),
            forcePathStyle,
            credentials: { accessKeyId, secretAccessKey },
        });
        return this.client;
    }
    bucketFor(isPrivate) {
        const key = isPrivate ? 'S3_PRIVATE_BUCKET' : 'S3_PUBLIC_BUCKET';
        const bucket = this.config.get(key);
        if (!bucket)
            throw new Error(`Missing ${key} configuration`);
        return bucket;
    }
    presignPut(bucket, key, contentType, expiresInSeconds) {
        const cmd = new client_s3_1.PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
        return (0, s3_request_presigner_1.getSignedUrl)(this.getClient(), cmd, { expiresIn: expiresInSeconds });
    }
    presignGet(bucket, key, expiresInSeconds) {
        const cmd = new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key });
        return (0, s3_request_presigner_1.getSignedUrl)(this.getClient(), cmd, { expiresIn: expiresInSeconds });
    }
    publicUrl(bucket, key) {
        const base = this.config.get('S3_PUBLIC_BASE_URL');
        if (base)
            return `${base.replace(/\/$/, '')}/${key}`;
        const endpoint = this.config.get('S3_ENDPOINT');
        if (endpoint)
            return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
        const region = this.config.get('S3_REGION') ?? 'us-east-1';
        return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    }
};
exports.StorageProvider = StorageProvider;
exports.StorageProvider = StorageProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageProvider);
//# sourceMappingURL=storage.provider.js.map