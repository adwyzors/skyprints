import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PaginationInterceptor } from './common/interceptors/pagination-meta.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api/v1');

    app.use(cookieParser());

    app.enableCors({
        origin: process.env.FRONT_END_BASE_URL?.split(",") ?? ["http://localhost:3000"],
        credentials: true,
        exposedHeaders: ['x-total-count', 'x-total-pages', 'x-page', 'x-limit', 'x-total-estimated-amount','x-total-quantity'],
    });

    app.useGlobalInterceptors(new PaginationInterceptor(), new LoggingInterceptor());

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    console.log(`[Bootstrap] NODE_ENV: ${process.env.NODE_ENV}, PORT: ${port}`);

    if (process.env.NODE_ENV === "local" || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        await app.listen(port, '0.0.0.0');
    } else {
        // Fallback or production behavior
        await app.listen(port, '0.0.0.0');
    }


    console.log(`Backend running on port ${port}`);
}


bootstrap();