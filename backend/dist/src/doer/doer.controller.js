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
exports.DoerController = void 0;
const common_1 = require("@nestjs/common");
const doer_service_js_1 = require("./doer.service.js");
const submit_kyc_dto_js_1 = require("./dto/submit-kyc.dto.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
let DoerController = class DoerController {
    doer;
    constructor(doer) {
        this.doer = doer;
    }
    getProfile(user) {
        return this.doer.getProfile(user.id);
    }
    submitKyc(user, dto) {
        return this.doer.submitKyc(user.id, dto);
    }
    getMyTasks(user) {
        return this.doer.getMyTasks(user.id);
    }
};
exports.DoerController = DoerController;
__decorate([
    (0, common_1.Get)('profile'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DoerController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Post)('kyc'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_kyc_dto_js_1.SubmitKycDto]),
    __metadata("design:returntype", void 0)
], DoerController.prototype, "submitKyc", null);
__decorate([
    (0, common_1.Get)('my-tasks'),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DoerController.prototype, "getMyTasks", null);
exports.DoerController = DoerController = __decorate([
    (0, common_1.Controller)('doer'),
    __metadata("design:paramtypes", [doer_service_js_1.DoerService])
], DoerController);
//# sourceMappingURL=doer.controller.js.map