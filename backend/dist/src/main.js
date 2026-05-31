"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_js_1 = require("./app.module.js");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_js_1.AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`HelpMi API running on http://localhost:${port}/api`);
}
bootstrap();
//# sourceMappingURL=main.js.map