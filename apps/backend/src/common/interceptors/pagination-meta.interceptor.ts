import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((result) => {
        // If no meta → return as-is
        if (!result || !result.meta) {
          return result;
        }

        const { page, limit, total, totalPages } = result.meta;

        // ✅ Standard pagination headers
        response.setHeader('X-Page', page);
        response.setHeader('X-Limit', limit);
        response.setHeader('X-Total-Count', total);
        response.setHeader('X-Total-Pages', totalPages);

        // ✅ Body contains ONLY data
        return result.data;
      }),
    );
  }
}
