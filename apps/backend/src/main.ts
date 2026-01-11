import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PaginationInterceptor } from './common/interceptors/pagination-meta.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 🔹 GLOBAL API PREFIX
    app.setGlobalPrefix('api/v1');

    app.use(cookieParser());

    // ✅ CORS (production-safe)
    app.enableCors({
        origin: process.env.CLIENT_URL || true, // allow Render / frontend domain
        credentials: true,
    });

    // ✅ Global interceptor
    app.useGlobalInterceptors(new PaginationInterceptor());

    // ✅ Global validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // ✅ REQUIRED for Render
    const port = Number(process.env.PORT) || 3001;
    await app.listen(port, '0.0.0.0');

    console.log(`🚀 Backend running on port ${port}`);
}

bootstrap();
