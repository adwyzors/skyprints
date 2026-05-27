import { Module } from '@nestjs/common';
import { ImageRetentionService } from './image-retention.service';
import { ImageRetentionController } from './image-retention.controller';
import { CloudflareService } from '../common/cloudflare.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ImageRetentionService, CloudflareService],
  controllers: [ImageRetentionController],
})
export class ImageRetentionModule {}
