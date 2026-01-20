import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PaginationInterceptor } from './common/interceptors/pagination-meta.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api/v1');

    app.use(cookieParser());

    app.enableCors({
        origin: process.env.FRONT_END_BASE_URL?.split(",") ?? ["http://localhost:3000"],
        credentials: true,
        exposedHeaders: ['x-total-count', 'x-total-pages', 'x-page', 'x-limit'],
    });

    app.useGlobalInterceptors(new PaginationInterceptor());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    await app.listen(port, '0.0.0.0');

    console.log(`Backend running on port ${port}`);
}


bootstrap();