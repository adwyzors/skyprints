// apps/backend/prisma/prisma.service.ts

import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

declare global {
    // eslint-disable-next-line no-var
    var __prisma__: PrismaClient | undefined;
}

const prisma =
    global.__prisma__ ??
    new PrismaClient({
        log: ['error', 'warn', 'query'],
    });

if (process.env.NODE_ENV !== 'production') {
    global.__prisma__ = prisma;
}

type PrismaExecutor = Prisma.TransactionClient | PrismaClient;


/* -------------------- helpers -------------------- */

type UnwrapPrismaPromise<T> =
    T extends Prisma.PrismaPromise<infer R> ? R : never;

type UnwrapTuple<T extends readonly unknown[]> = {
    [K in keyof T]: UnwrapPrismaPromise<T[K]>;
};

/* -------------------- service -------------------- */

@Injectable()
export class PrismaService {
    private readonly DEFAULT_TX_TIMEOUT =
        process.env.NODE_ENV === 'production' ? 10_000 : 60_000;

    /* ---------- MODEL GETTERS ---------- */

    get user() {
        return prisma.user;
    }

    get customer() {
        return prisma.customer;
    }

    get order() {
        return prisma.order;
    }

    get orderSequence() {
        return prisma.orderSequence;
    }

    get workflowType() {
        return prisma.workflowType;
    }

    get workflowStatus() {
        return prisma.workflowStatus;
    }

    get workflowTransition() {
        return prisma.workflowTransition;
    }

    get workflowAuditLog() {
        return prisma.workflowAuditLog;
    }

    get runTemplate() {
        return prisma.runTemplate;
    }

    get process() {
        return prisma.process;
    }

    get processRunDefinition() {
        return prisma.processRunDefinition;
    }

    get orderProcess() {
        return prisma.orderProcess;
    }

    get processRun() {
        return prisma.processRun;
    }

    get location() {
        return prisma.location;
    }

    get notification() {
        return prisma.notification;
    }

    get outboxEvent() {
        return prisma.outboxEvent;
    }

    get billingContext() {
        return prisma.billingContext;
    }

    get billingContextOrder() {
        return prisma.billingContextOrder;
    }

    get billingSnapshot() {
        return prisma.billingSnapshot;
    }

    /* ---------- TRANSACTIONS ---------- */

    // Functional transaction
    async transaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: Parameters<PrismaClient['$transaction']>[1],
    ): Promise<T>;

    // Batch transaction (tuple-safe)
    async transaction<P extends readonly Prisma.PrismaPromise<any>[]>(
        promises: readonly [...P],
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
    ): Promise<UnwrapTuple<P>>;

    async transaction(arg: any, options?: any) {
        if (typeof arg === 'function') {
            return prisma.$transaction(arg, {
                timeout: this.DEFAULT_TX_TIMEOUT,
                ...options,
            });
        }

        return prisma.$transaction(arg, options);
    }

    /* ---------- ESCAPE HATCH ---------- */
    get client() {
        return prisma;
    }
}
