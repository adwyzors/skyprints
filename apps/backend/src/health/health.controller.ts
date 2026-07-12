import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return { status: 'Itz Ok Bro', timestamp: new Date().toISOString() };
  }
}
