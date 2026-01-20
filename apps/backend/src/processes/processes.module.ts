import { Module } from '@nestjs/common';
import { AdminProcessController } from './admin-process.controller';
import { AdminProcessService } from './admin-process.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
    controllers: [AdminProcessController],
    providers: [AdminProcessService],
    exports: [AdminProcessService],
    imports: [OrdersModule]
})
export class ProcessesModule { }
