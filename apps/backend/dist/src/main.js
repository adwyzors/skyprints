"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app_module_1 = require("./app.module");
const pagination_meta_interceptor_1 = require("./common/interceptors/pagination-meta.interceptor");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api/v1');
    app.use((0, cookie_parser_1.default)());
    app.enableCors({
        origin: process.env.CLIENT_URL || true,
        credentials: true,
    });
    app.useGlobalInterceptors(new pagination_meta_interceptor_1.PaginationInterceptor());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    await app.listen(port, '0.0.0.0');
    console.log(`Backend running on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map