import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  // Request validation is per-route via `ZodValidationPipe` with the schemas
  // shared with the web app, so no global class-validator pipe is installed.

  // The session is a cookie, so the browser only sends it when the API trusts
  // this exact origin with credentials. A wildcard origin is not permitted
  // alongside credentials, which is the point.
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });

  // Behind a proxy in production, so `secure` cookies and client IPs (used by
  // the login rate limit) are derived from the forwarded headers.
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
