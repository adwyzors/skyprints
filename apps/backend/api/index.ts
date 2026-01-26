import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
// Register tsconfig paths to verify module resolution in serverless environment
import 'tsconfig-paths/register';
import { AppModule } from '../src/app.module';
import { PaginationInterceptor } from '../src/common/interceptors/pagination-meta.interceptor';

let app;

export default async function (req, res) {
    if (!app) {
        app = await NestFactory.create(AppModule);

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

        await app.init();
    }
    const instance = app.getHttpAdapter().getInstance();
    return instance(req, res);
}
