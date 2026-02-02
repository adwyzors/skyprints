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

                const { page, limit, total, totalPages, totalEstimatedAmount } = result.meta;

                if (page !== undefined) {
                    response.setHeader('X-Page', String(page));
                }

                if (limit !== undefined) {
                    response.setHeader('X-Limit', String(limit));
                }

                if (total !== undefined) {
                    response.setHeader('X-Total-Count', String(total));
                }

                if (totalPages !== undefined) {
                    response.setHeader('X-Total-Pages', String(totalPages));
                }

                if (totalEstimatedAmount !== undefined) {
                    response.setHeader('X-Total-Estimated-Amount', String(totalEstimatedAmount));
                }

                return result.data ?? result;
            }),
        );
    }
}
