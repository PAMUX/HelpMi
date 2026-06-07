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
exports.PayoutProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let PayoutProvider = class PayoutProvider {
    config;
    logger = new common_1.Logger('PayoutProvider');
    constructor(config) {
        this.config = config;
    }
    async dispatch(input) {
        if (input.method === 'BANK') {
            return { status: 'PENDING' };
        }
        return this.dispatchWallet(input);
    }
    async dispatchWallet(input) {
        const apiKey = this.config.get('PAYHERE_PAYOUT_API_KEY');
        if (!apiKey) {
            this.logger.warn('PAYHERE_PAYOUT_API_KEY not set; wallet payout queued (PROCESSING)');
            return { status: 'PROCESSING' };
        }
        try {
            return { status: 'PROCESSING', providerRef: `wallet-${input.payoutId}` };
        }
        catch (err) {
            this.logger.error(`Wallet payout failed: ${err.message}`);
            return { status: 'FAILED', failureReason: err.message };
        }
    }
};
exports.PayoutProvider = PayoutProvider;
exports.PayoutProvider = PayoutProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PayoutProvider);
//# sourceMappingURL=payout.provider.js.map