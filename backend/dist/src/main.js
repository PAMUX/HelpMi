"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_js_1 = require("./app.module.js");
const http_exception_filter_js_1 = require("./common/filters/http-exception.filter.js");
const logging_interceptor_js_1 = require("./common/interceptors/logging.interceptor.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    app.setGlobalPrefix('api');
    app.use((0, helmet_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_js_1.AllExceptionsFilter());
    app.useGlobalInterceptors(new logging_interceptor_js_1.LoggingInterceptor());
    const origins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    app.enableCors({
        origin: origins.length ? origins : true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        credentials: true,
    });
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('HelpMi API')
        .setDescription('Odd-jobs marketplace backend — Sri Lanka. All endpoints are under /api.')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
        .addTag('auth', 'Phone-OTP authentication')
        .addTag('users', 'User profile + PDPA')
        .addTag('doer', 'Doer profile, KYC, payouts')
        .addTag('categories', 'Task categories')
        .addTag('tasks', 'Task lifecycle')
        .addTag('payments', 'Escrow + posting-fee payments')
        .addTag('ratings', 'Two-sided ratings')
        .addTag('messages', 'In-app chat')
        .addTag('notifications', 'Notifications')
        .addTag('admin', 'Admin: KYC, disputes, payouts')
        .addTag('uploads', 'Presigned uploads')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`HelpMi API running on http://localhost:${port}/api`);
    console.log(`Swagger UI at http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map