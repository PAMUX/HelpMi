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
exports.MessagesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const messages_service_js_1 = require("./messages.service.js");
const send_message_dto_js_1 = require("./dto/send-message.dto.js");
const current_user_decorator_js_1 = require("../common/decorators/current-user.decorator.js");
let MessagesController = class MessagesController {
    messages;
    constructor(messages) {
        this.messages = messages;
    }
    getUnreadCount(user) {
        return this.messages.getUnreadCount(user.id);
    }
    getMessages(taskId, user) {
        return this.messages.getMessages(taskId, user.id);
    }
    sendMessage(taskId, user, dto) {
        return this.messages.sendMessage(taskId, user.id, dto);
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Unread message count' }),
    (0, common_1.Get)('unread'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "getUnreadCount", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get a task thread (marks read)' }),
    (0, common_1.Get)(':taskId'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "getMessages", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Send a message' }),
    (0, common_1.Post)(':taskId'),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('taskId')),
    __param(1, (0, current_user_decorator_js_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, send_message_dto_js_1.SendMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "sendMessage", null);
exports.MessagesController = MessagesController = __decorate([
    (0, swagger_1.ApiTags)('messages'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, common_1.Controller)('messages'),
    __metadata("design:paramtypes", [messages_service_js_1.MessagesService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map