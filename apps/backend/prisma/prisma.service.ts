// apps/backend/prisma/prisma.service.ts

import {
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';


type UnwrapPrismaPromise<T> =
    T extends Prisma.PrismaPromise<infer R> ? R : never;

type UnwrapTuple<T extends readonly unknown[]> = {
    [K in keyof T]: UnwrapPrismaPromise<T[K]>;
};


@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {


    constructor() {
        super({
            log: ['error', 'warn'],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    private readonly DEFAULT_TX_TIMEOUT =
        process.env.NODE_ENV === 'production'
            ? 10_000
            : 60_000;

    async transaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
        options?: Parameters<PrismaClient['$transaction']>[1],
    ): Promise<T>;

    // Batch (tuple-safe!)
    async transaction<P extends readonly Prisma.PrismaPromise<any>[]>(
        promises: readonly [...P],
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
    ): Promise<UnwrapTuple<P>>;

    async transaction(arg: any, options?: any) {
        if (typeof arg === 'function') {
            return this.$transaction(arg, {
                timeout: this.DEFAULT_TX_TIMEOUT,
                ...options,
            });
        }

        return this.$transaction(arg, options);
    }
}
