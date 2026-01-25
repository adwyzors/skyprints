import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RequestContextStore } from '../context/request-context.store';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const correlationId =
      req.headers['x-correlation-id'] ?? randomUUID();

    RequestContextStore.run(
      {
        correlationId,
      },
      () => {
        req.correlationId = correlationId;
        res.setHeader('x-correlation-id', correlationId);
        next();
      },
    );
  }
}
