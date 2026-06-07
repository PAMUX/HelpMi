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
exports.PaymentsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const payments_service_js_1 = require("./payments.service.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
const public_decorator_js_1 = require("../common/decorators/public.decorator.js");
let PaymentsController = class PaymentsController {
    payments;
    constructor(payments) {
        this.payments = payments;
    }
    getEscrow(taskId, user) {
        return this.payments.getEscrow(taskId, user.id);
    }
    initiatePayment(taskId, user) {
        return this.payments.initiatePayment(taskId, user.id);
    }
    handleWebhook(body) {
        return this.payments.handleWebhook(body);
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get escrow for a task' }),
    (0, common_1.Get)(':taskId'),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "getEscrow", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Initiate PayHere payment (escrow or Rs.99 fee)' }),
    (0, common_1.Post)('initiate/:taskId'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "initiatePayment", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'PayHere webhook (server-to-server)' }),
    (0, public_decorator_js_1.Public)(),
    (0, common_1.Post)('webhook'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PaymentsController.prototype, "handleWebhook", null);
exports.PaymentsController = PaymentsController = __decorate([
    (0, swagger_1.ApiTags)('payments'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('payments'),
    __metadata("design:paramtypes", [payments_service_js_1.PaymentsService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map