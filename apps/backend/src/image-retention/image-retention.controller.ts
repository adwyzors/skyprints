import {
  Controller,
  Post,
  Headers,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ImageRetentionService } from './image-retention.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Exposes a POST endpoint to trigger image retention cleanup.
 * Protected by a simple secret header in production.
 */
@Controller('internal/image-retention')
export class ImageRetentionController {
  private readonly secret = process.env.IMAGE_RETENTION_SECRET ?? 'dev-secret';

  constructor(private readonly retentionService: ImageRetentionService) {}

  @Public()
  @Post('cleanup')
  async cleanup(
    @Headers('authorization') authorization?: string,
    @Headers('x-limit') limitHeader?: string,
    @Headers('x-dry-run') dryRunHeader?: string,
    @Headers('x-retention-days') retentionDaysHeader?: string,
  ) {
    const isProd = process.env.NODE_ENV === 'prod';

    /**
     * Vercel Cron automatically sends:
     * Authorization: Bearer <CRON_SECRET>
     */
    if (isProd) {
      const expected = `Bearer ${process.env.CRON_SECRET}`;

      if (authorization !== expected) {
        throw new BadRequestException('Invalid cron authorization');
      }
    }

    const limit = limitHeader ? parseInt(limitHeader, 10) : undefined;

    const dryRun = dryRunHeader === 'true' || dryRunHeader === '1';

    const retentionDays = retentionDaysHeader
      ? parseInt(retentionDaysHeader, 10)
      : undefined;

    try {
      const result = await this.retentionService.cleanup({
        limit,
        dryRun,
        retentionDays,
      });

      return result;
    } catch (err) {
      throw new InternalServerErrorException('Cleanup failed');
    }
  }
}
