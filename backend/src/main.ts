import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/**
 * Origins allowed to call the API from a browser, from CORS_ORIGINS
 * (comma-separated, e.g. "https://breathing-room.vercel.app"). When it is
 * not set, every origin is allowed, which keeps local development simple.
 */
function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin !== '');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const origins = allowedOrigins();
  app.enableCors(origins.length > 0 ? { origin: origins } : undefined);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
