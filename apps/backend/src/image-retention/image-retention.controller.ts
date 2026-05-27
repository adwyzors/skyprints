import { Controller, Post, Headers, BadRequestException, InternalServerErrorException } from '@nestjs/common';
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
    @Headers('x-cleanup-secret') secretHeader: string,
    @Headers('x-limit') limitHeader?: string,
    @Headers('x-dry-run') dryRunHeader?: string,
  ) {
    // In non-prod allow without secret for ease of testing.
    const isProd = process.env.NODE_ENV === 'prod';
    if (isProd && secretHeader !== this.secret) {
      throw new BadRequestException('Invalid cleanup secret');
    }
    const limit = limitHeader ? parseInt(limitHeader, 10) : undefined;
    const dryRun = dryRunHeader === 'true' || dryRunHeader === '1';
    try {
      const result = await this.retentionService.cleanup({ limit, dryRun });
      return result;
    } catch (err) {
      throw new InternalServerErrorException('Cleanup failed');
    }
  }
}
