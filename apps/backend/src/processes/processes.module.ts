import { Module } from '@nestjs/common';
import { AdminProcessController } from './admin-process.controller';
import { AdminProcessService } from './admin-process.service';

@Module({
    controllers: [AdminProcessController],
    providers: [AdminProcessService],
    exports: [AdminProcessService],
})
export class ProcessesModule { }
