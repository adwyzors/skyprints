import { Logger } from '@nestjs/common';
import { RequestContextStore } from '../context/request-context.store';

export class ContextLogger extends Logger {
    log(message: string) {
        const ctx = RequestContextStore.getStore();
        super.log(
            ctx?.correlationId
                ? `[cid=${ctx.correlationId}] ${message}`
                : message,
        );
    }

    debug(message: string) {
        const ctx = RequestContextStore.getStore();
        super.debug(
            ctx?.correlationId
                ? `[cid=${ctx.correlationId}] ${message}`
                : message,
        );
    }


    error(message: string, trace?: string) {
        const ctx = RequestContextStore.getStore();
        super.error(
            ctx?.correlationId
                ? `[cid=${ctx.correlationId}] ${message}`
                : message,
            trace,
        );
    }
}
