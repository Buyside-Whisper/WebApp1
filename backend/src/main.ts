import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { TranslateExceptionFilter } from './common/i18n/translate.filter.js';
import { TranslateReportInterceptor } from './common/i18n/translate.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: 'http://localhost:4200' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new TranslateExceptionFilter());
  app.useGlobalInterceptors(new TranslateReportInterceptor());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
