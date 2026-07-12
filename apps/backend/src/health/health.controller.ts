import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return { status: 'All good Bro', timestamp: new Date().toISOString() };
  }
}
