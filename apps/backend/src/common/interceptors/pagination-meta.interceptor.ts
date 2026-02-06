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
                    response.setHeader('x-page', String(page));
                }

                if (limit !== undefined) {
                    response.setHeader('x-limit', String(limit));
                }

                if (total !== undefined) {
                    response.setHeader('x-total-count', String(total));
                }

                if (totalPages !== undefined) {
                    response.setHeader('x-total-pages', String(totalPages));
                }

                if (totalEstimatedAmount !== undefined) {
                    response.setHeader('x-total-estimated-amount', String(totalEstimatedAmount));
                }

                return result.data ?? result;
            }),
        );
    }
}
