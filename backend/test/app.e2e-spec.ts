import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/http-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * P4-B: E2E smoke suite. Boots the full Nest app (global prefix, validation,
 * filters, guards) the same way main.ts does. Requires a reachable PostgreSQL
 * (DATABASE_URL) — run with `npm run test:e2e` against a test database after
 * `prisma migrate deploy`.
 */
describe('HelpMi API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    const cfg = new DocumentBuilder().setTitle('HelpMi API').setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' }, 'access-token')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, cfg));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/categories is public and returns an array', async () => {
    const res = await request(app.getHttpServer()).get('/api/categories').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/users/me without a token is 401', () => {
    return request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('GET /api/tasks/nearby without a token is 401', () => {
    return request(app.getHttpServer()).get('/api/tasks/nearby?lat=6.9&lng=79.8').expect(401);
  });

  it('POST /api/auth/otp/request with an invalid phone is 400', () => {
    return request(app.getHttpServer())
      .post('/api/auth/otp/request')
      .send({ phone: 'not-a-phone' })
      .expect(400);
  });

  it('POST /api/auth/otp/request with a valid phone returns the standard message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/otp/request')
      .send({ phone: '+94770000001' })
      .expect(200);
    expect(res.body.message).toBeDefined();
  });

  it('POST /api/payments/webhook with a bad signature is rejected (400)', () => {
    return request(app.getHttpServer())
      .post('/api/payments/webhook')
      .send({ merchant_id: 'x', order_id: 'HM-1', status_code: '2', md5sig: 'BAD' })
      .expect(400);
  });

  it('Swagger JSON is served at /api/docs-json', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.openapi).toBeDefined();
    expect(res.body.paths['/api/auth/otp/request']).toBeDefined();
  });
});
