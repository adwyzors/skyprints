import { forwardRef, Module } from '@nestjs/common';
import { CloudflareService } from '../common/cloudflare.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { BillingModule } from '../billing/billing.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => BillingModule), NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, CloudflareService],
  exports: [OrdersService],
})
export class OrdersModule {}
