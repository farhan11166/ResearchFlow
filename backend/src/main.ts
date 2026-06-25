import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'; 
import {Logger} from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  app.useLogger(app.get(Logger));// enable pino


  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
  }));
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
