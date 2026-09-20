import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SideTasksController } from './side-tasks.controller';
import { SideTasksService } from './side-tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [SideTasksController],
  providers: [SideTasksService],
  exports: [SideTasksService],
})
export class SideTasksModule {}
