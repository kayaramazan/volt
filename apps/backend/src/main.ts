import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// Prisma BigInt columns (currentRevision, revision, etc.) can't be JSON.stringify'd
// by default — Express's res.json() throws "Do not know how to serialize a BigInt".
// Polyfill toJSON globally so any BigInt anywhere serializes as a decimal string.
// The desktop client already coerces revisions to strings on its side.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: true,
    // Raw body required for Stripe webhook signature verification —
    // BillingController reads `req.rawBody` for /api/webhooks/stripe.
    rawBody: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false, // Electron app sets its own CSP
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow Electron app:// protocol (origin is "null" or "app://volt")
      if (!origin || origin === 'null') return callback(null, true);
      if (corsOrigins.some((o) => o === origin || matchesWildcard(o, origin))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Last-Event-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.setGlobalPrefix('api', { exclude: ['health'] });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Volt backend on :${port}`);
  logger.log(`   CORS origins: ${corsOrigins.join(', ')}`);
}

function matchesWildcard(pattern: string, value: string): boolean {
  if (!pattern.includes('*')) return false;
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return regex.test(value);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
