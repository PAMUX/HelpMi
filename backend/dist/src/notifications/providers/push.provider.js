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
exports.pushProviderFactory = exports.FcmPushProvider = exports.ConsolePushProvider = exports.PUSH_PROVIDER = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
exports.PUSH_PROVIDER = 'PUSH_PROVIDER';
let ConsolePushProvider = class ConsolePushProvider {
    logger = new common_1.Logger('ConsolePushProvider');
    sendToToken(token, payload) {
        this.logger.log(`[PUSH→${token.slice(0, 12)}…] ${payload.title} — ${payload.body}`);
        return Promise.resolve();
    }
};
exports.ConsolePushProvider = ConsolePushProvider;
exports.ConsolePushProvider = ConsolePushProvider = __decorate([
    (0, common_1.Injectable)()
], ConsolePushProvider);
let FcmPushProvider = class FcmPushProvider {
    config;
    logger = new common_1.Logger('FcmPushProvider');
    constructor(config) {
        this.config = config;
    }
    async sendToToken(token, payload) {
        try {
            const projectId = this.config.get('FCM_PROJECT_ID');
            if (!projectId) {
                this.logger.warn('FCM_PROJECT_ID not set; skipping push');
                return;
            }
            const accessToken = await this.getAccessToken();
            if (!accessToken)
                return;
            const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title: payload.title, body: payload.body },
                        data: payload.data ?? {},
                    },
                }),
            });
            if (!res.ok) {
                this.logger.warn(`FCM send failed (${res.status}): ${await res.text()}`);
            }
        }
        catch (err) {
            this.logger.error(`FCM send error: ${err.message}`);
        }
    }
    getAccessToken() {
        const saJson = this.config.get('FCM_SERVICE_ACCOUNT_JSON');
        if (!saJson) {
            this.logger.warn('FCM_SERVICE_ACCOUNT_JSON not set; cannot obtain access token');
            return Promise.resolve(null);
        }
        return Promise.resolve(null);
    }
};
exports.FcmPushProvider = FcmPushProvider;
exports.FcmPushProvider = FcmPushProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FcmPushProvider);
exports.pushProviderFactory = {
    provide: exports.PUSH_PROVIDER,
    inject: [config_1.ConfigService],
    useFactory: (config) => {
        const kind = (config.get('PUSH_PROVIDER') ?? 'console').toLowerCase();
        if (kind === 'fcm')
            return new FcmPushProvider(config);
        return new ConsolePushProvider();
    },
};
//# sourceMappingURL=push.provider.js.map