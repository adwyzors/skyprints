import { Module } from '@nestjs/common';
import { CloudflareService } from '../common/cloudflare.service';
import { BillingModule } from '../billing/billing.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminProcessController } from './admin-process.controller';
import { AdminProcessService } from './admin-process.service';

@Module({
    controllers: [AdminProcessController],
    providers: [AdminProcessService, CloudflareService],
    exports: [AdminProcessService],
    imports: [OrdersModule, BillingModule]
})
export class ProcessesModule { }
