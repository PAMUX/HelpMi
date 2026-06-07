import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // P3-C: security headers.
  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // P3-C: consistent error shape + structured request logging.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // P3-C: restricted CORS — configure allowed origins via CORS_ORIGINS
  // (comma-separated). Falls back to reflecting any origin in dev.
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // P4-A: OpenAPI / Swagger UI at /api/docs with a JWT Authorize button.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HelpMi API')
    .setDescription('Odd-jobs marketplace backend — Sri Lanka. All endpoints are under /api.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
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
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`HelpMi API running on http://localhost:${port}/api`);
  console.log(`Swagger UI at http://localhost:${port}/api/docs`);
}

bootstrap();
