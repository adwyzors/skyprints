import { Module } from '@nestjs/common';
import { CloudflareService } from '../common/cloudflare.service';
import { OrdersModule } from '../orders/orders.module';
import { AdminProcessController } from './admin-process.controller';
import { AdminProcessService } from './admin-process.service';

@Module({
    controllers: [AdminProcessController],
    providers: [AdminProcessService, CloudflareService],
    exports: [AdminProcessService],
    imports: [OrdersModule]
})
export class ProcessesModule { }
