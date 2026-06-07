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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const swagger_1 = require("@nestjs/swagger");
const auth_service_js_1 = require("./auth.service.js");
const request_otp_dto_js_1 = require("./dto/request-otp.dto.js");
const verify_otp_dto_js_1 = require("./dto/verify-otp.dto.js");
const public_decorator_js_1 = require("../common/decorators/public.decorator.js");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    requestOtp(dto) {
        return this.auth.requestOtp(dto);
    }
    resendOtp(dto) {
        return this.auth.resendOtp(dto);
    }
    verifyOtp(dto) {
        return this.auth.verifyOtp(dto);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Request an OTP for a phone number' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'OTP sent' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Rate limited' }),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)('otp/request'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_otp_dto_js_1.RequestOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "requestOtp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Resend an OTP (cooldown enforced)' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Cooldown not elapsed' }),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)('otp/resend'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_otp_dto_js_1.RequestOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendOtp", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Verify an OTP and receive a JWT' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns accessToken + user' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid/expired OTP or too many attempts' }),
    (0, throttler_1.Throttle)({ default: { ttl: 60_000, limit: 5 } }),
    (0, common_1.Post)('otp/verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [verify_otp_dto_js_1.VerifyOtpDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyOtp", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_js_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map