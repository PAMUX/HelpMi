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
exports.smsProviderFactory = exports.TwilioSmsProvider = exports.DialogSmsProvider = exports.ConsoleSmsProvider = exports.SMS_PROVIDER = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
exports.SMS_PROVIDER = 'SMS_PROVIDER';
const otpMessage = (code) => `Your HelpMi verification code is ${code}. It expires in 5 minutes. Do not share it with anyone.`;
let ConsoleSmsProvider = class ConsoleSmsProvider {
    logger = new common_1.Logger('ConsoleSmsProvider');
    sendOtp(phone, code) {
        this.logger.log(`[SMS→${phone}] ${otpMessage(code)}`);
        return Promise.resolve();
    }
};
exports.ConsoleSmsProvider = ConsoleSmsProvider;
exports.ConsoleSmsProvider = ConsoleSmsProvider = __decorate([
    (0, common_1.Injectable)()
], ConsoleSmsProvider);
let DialogSmsProvider = class DialogSmsProvider {
    config;
    logger = new common_1.Logger('DialogSmsProvider');
    constructor(config) {
        this.config = config;
    }
    async sendOtp(phone, code) {
        const url = this.config.get('SMS_GATEWAY_URL');
        const apiKey = this.config.get('SMS_GATEWAY_API_KEY');
        const sender = this.config.get('SMS_SENDER_ID') ?? 'HelpMi';
        if (!url || !apiKey) {
            throw new Error('SMS gateway not configured (SMS_GATEWAY_URL / SMS_GATEWAY_API_KEY)');
        }
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                msisdn: phone,
                message: otpMessage(code),
                sourceAddress: sender,
            }),
        });
        if (!res.ok) {
            this.logger.error(`SMS gateway error ${res.status}: ${await res.text()}`);
            throw new Error(`SMS gateway returned ${res.status}`);
        }
    }
};
exports.DialogSmsProvider = DialogSmsProvider;
exports.DialogSmsProvider = DialogSmsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DialogSmsProvider);
let TwilioSmsProvider = class TwilioSmsProvider {
    config;
    logger = new common_1.Logger('TwilioSmsProvider');
    constructor(config) {
        this.config = config;
    }
    async sendOtp(phone, code) {
        const sid = this.config.get('TWILIO_ACCOUNT_SID');
        const token = this.config.get('TWILIO_AUTH_TOKEN');
        const from = this.config.get('TWILIO_FROM_NUMBER');
        if (!sid || !token || !from) {
            throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER)');
        }
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: phone, From: from, Body: otpMessage(code) }),
        });
        if (!res.ok) {
            this.logger.error(`Twilio error ${res.status}: ${await res.text()}`);
            throw new Error(`Twilio returned ${res.status}`);
        }
    }
};
exports.TwilioSmsProvider = TwilioSmsProvider;
exports.TwilioSmsProvider = TwilioSmsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TwilioSmsProvider);
exports.smsProviderFactory = {
    provide: exports.SMS_PROVIDER,
    inject: [config_1.ConfigService],
    useFactory: (config) => {
        const kind = (config.get('SMS_PROVIDER') ?? 'console').toLowerCase();
        if (kind === 'dialog')
            return new DialogSmsProvider(config);
        if (kind === 'twilio')
            return new TwilioSmsProvider(config);
        return new ConsoleSmsProvider();
    },
};
//# sourceMappingURL=sms.provider.js.map