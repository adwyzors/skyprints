import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PaginationInterceptor } from './common/interceptors/pagination-meta.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔹 GLOBAL API PREFIX
  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

    app.useGlobalInterceptors(new PaginationInterceptor());


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
}

bootstrap();
