import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CloudflareService } from '../common/cloudflare.service';
import { SideTasksController } from './side-tasks.controller';
import { SideTasksService } from './side-tasks.service';

@Module({
  imports: [PrismaModule],
  controllers: [SideTasksController],
  providers: [SideTasksService, CloudflareService],
  exports: [SideTasksService],
})
export class SideTasksModule {}

