import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`HelpMi API running on http://localhost:${port}/api`);
}

bootstrap();
