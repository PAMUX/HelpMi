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
const common_1 = require("@nestjs/common");
const admin_service_js_1 = require("./admin.service.js");
const admin_guard_js_1 = require("../common/guards/admin.guard.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
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
    approveKyc(id, admin, tier) {
        return this.admin.approveKyc(id, admin.phone, tier);
    }
    rejectKyc(id, admin, note) {
        return this.admin.rejectKyc(id, admin.phone, note);
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
    resolveDispute(id, admin, resolutionNote, refundPoster) {
        return this.admin.resolveDispute(id, admin.phone, resolutionNote, refundPoster);
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('kyc/pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getPendingKyc", null);
__decorate([
    (0, common_1.Patch)('kyc/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)('tier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "approveKyc", null);
__decorate([
    (0, common_1.Patch)('kyc/:id/reject'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)('note')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "rejectKyc", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Patch)('users/:id/ban'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "banUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/unban'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "unbanUser", null);
__decorate([
    (0, common_1.Get)('disputes'),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getDisputes", null);
__decorate([
    (0, common_1.Patch)('disputes/:id/resolve'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)('resolutionNote')),
    __param(3, (0, common_1.Body)('refundPoster')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String, Boolean]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveDispute", null);
exports.AdminController = AdminController = __decorate([
    (0, common_1.UseGuards)(admin_guard_js_1.AdminGuard),
    (0, common_1.Controller)('admin'),
    __metadata("design:paramtypes", [admin_service_js_1.AdminService])
], AdminController);
//# sourceMappingURL=admin.controller.js.map