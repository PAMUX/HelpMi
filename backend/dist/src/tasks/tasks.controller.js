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
exports.TasksController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tasks_service_js_1 = require("./tasks.service.js");
const create_task_dto_js_1 = require("./dto/create-task.dto.js");
const nearby_tasks_dto_js_1 = require("./dto/nearby-tasks.dto.js");
const complete_task_dto_js_1 = require("./dto/complete-task.dto.js");
const raise_dispute_dto_js_1 = require("./dto/raise-dispute.dto.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
let TasksController = class TasksController {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    create(user, dto) {
        return this.tasks.create(user.id, dto);
    }
    findNearby(dto, user) {
        return this.tasks.findNearby(dto, user.id);
    }
    getPostedTasks(user) {
        return this.tasks.getPostedTasks(user.id);
    }
    getAcceptedTasks(user) {
        return this.tasks.getAcceptedTasks(user.id);
    }
    findOne(id, user) {
        return this.tasks.findById(id, user.id);
    }
    accept(id, user) {
        return this.tasks.accept(id, user.id);
    }
    markStarted(id, user) {
        return this.tasks.markStarted(id, user.id);
    }
    markComplete(id, user, dto) {
        return this.tasks.markComplete(id, user.id, dto);
    }
    confirm(id, user) {
        return this.tasks.confirm(id, user.id);
    }
    cancel(id, user) {
        return this.tasks.cancel(id, user.id);
    }
    raiseDispute(id, user, dto) {
        return this.tasks.raiseDispute(id, user.id, dto.reason);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Create a task (ESCROW or CASH; starts PENDING_PAYMENT)' }),
    (0, common_1.Post)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_task_dto_js_1.CreateTaskDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Browse nearby open tasks (tier-filtered)' }),
    (0, common_1.Get)('nearby'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [nearby_tasks_dto_js_1.NearbyTasksDto, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findNearby", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Tasks I posted' }),
    (0, common_1.Get)('my/posted'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "getPostedTasks", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Tasks I accepted' }),
    (0, common_1.Get)('my/accepted'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "getAcceptedTasks", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Task detail (participant-aware)' }),
    (0, common_1.Get)(':id'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Doer accepts an open task' }),
    (0, common_1.Post)(':id/accept'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "accept", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Doer marks task in progress' }),
    (0, common_1.Post)(':id/start'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "markStarted", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Doer marks task complete (photo proof)' }),
    (0, common_1.Post)(':id/complete'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, complete_task_dto_js_1.CompleteTaskDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "markComplete", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Poster confirms completion → releases escrow' }),
    (0, common_1.Post)(':id/confirm'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "confirm", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a task' }),
    (0, common_1.Post)(':id/cancel'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "cancel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Raise a dispute' }),
    (0, common_1.Post)(':id/dispute'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, raise_dispute_dto_js_1.RaiseDisputeDto]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "raiseDispute", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)('tasks'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [tasks_service_js_1.TasksService])
], TasksController);
//# sourceMappingURL=tasks.controller.js.map