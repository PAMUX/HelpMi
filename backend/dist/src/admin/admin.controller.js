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
exports.AdminController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const admin_service_js_1 = require("./admin.service.js");
const admin_guard_js_1 = require("../common/guards/admin.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const approve_kyc_dto_js_1 = require("./dto/approve-kyc.dto.js");
const reject_kyc_dto_js_1 = require("./dto/reject-kyc.dto.js");
const resolve_dispute_dto_js_1 = require("./dto/resolve-dispute.dto.js");
const mark_paid_dto_js_1 = require("./dto/mark-paid.dto.js");
let AdminController = class AdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    getStats() {
        return this.admin.getStats();
    }
    getPendingKyc() {
        return this.admin.getPendingKyc();
    }
    approveKyc(id, admin, dto) {
        return this.admin.approveKyc(id, admin.phone, dto.tier);
    }
    rejectKyc(id, admin, dto) {
        return this.admin.rejectKyc(id, admin.phone, dto.note);
    }
    getUsers(page, limit) {
        return this.admin.getUsers(page ? +page : 1, limit ? +limit : 50);
    }
    banUser(id) {
        return this.admin.banUser(id);
    }
    unbanUser(id) {
        return this.admin.unbanUser(id);
    }
    getDisputes(status) {
        return this.admin.getDisputes(status);
    }
    resolveDispute(id, admin, dto) {
        return this.admin.resolveDispute(id, admin.phone, dto.resolutionNote, dto.refundPoster);
    }
    listPayouts(status) {
        return this.admin.listPayouts(status);
    }
    markPaid(id, dto) {
        return this.admin.markPayoutPaid(id, dto.providerRef);
    }
    exportPayouts(status) {
        return this.admin.exportPayoutsCsv(status);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard stats' }),
    (0, common_1.Get)('stats'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getStats", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Pending KYC queue' }),
    (0, common_1.Get)('kyc/pending'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getPendingKyc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Approve KYC + set tier' }),
    (0, common_1.Patch)('kyc/:id/approve'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, approve_kyc_dto_js_1.ApproveKycDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approveKyc", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Reject KYC' }),
    (0, common_1.Patch)('kyc/:id/reject'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, reject_kyc_dto_js_1.RejectKycDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rejectKyc", null);
__decorate([
    openapi.ApiQuery({ name: "page", required: false }),
    openapi.ApiQuery({ name: "limit", required: false }),
    (0, swagger_1.ApiOperation)({ summary: 'List users (paginated)' }),
    (0, common_1.Get)('users'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Ban a user' }),
    (0, common_1.Patch)('users/:id/ban'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "banUser", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Unban a user' }),
    (0, common_1.Patch)('users/:id/unban'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "unbanUser", null);
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, swagger_1.ApiOperation)({ summary: 'List disputes' }),
    (0, common_1.Get)('disputes'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getDisputes", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Resolve a dispute' }),
    (0, common_1.Patch)('disputes/:id/resolve'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, resolve_dispute_dto_js_1.ResolveDisputeDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveDispute", null);
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, swagger_1.ApiOperation)({ summary: 'List payouts' }),
    (0, common_1.Get)('payouts'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "listPayouts", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Mark a (bank) payout paid' }),
    (0, common_1.Patch)('payouts/:id/mark-paid'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, mark_paid_dto_js_1.MarkPaidDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "markPaid", null);
__decorate([
    openapi.ApiQuery({ name: "status", required: false }),
    (0, swagger_1.ApiOperation)({ summary: 'Export payouts as CSV' }),
    (0, common_1.Get)('payouts/export'),
    (0, common_1.Header)('Content-Type', 'text/csv'),
    (0, common_1.Header)('Content-Disposition', 'attachment; filename="payouts.csv"'),
    openapi.ApiResponse({ status: 200, type: String }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "exportPayouts", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.UseGuards)(admin_guard_js_1.AdminGuard),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_js_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map