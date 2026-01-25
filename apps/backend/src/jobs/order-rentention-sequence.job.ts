import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';

@Injectable()
export class OrderRetentionAndSequenceJob {
    private readonly logger = new ContextLogger(
        OrderRetentionAndSequenceJob.name,
    );

    private readonly enabled =
        process.env.ORDER_RETENTION_ENABLED === 'true';

    constructor(private readonly prisma: PrismaService) { }

    @Cron(process.env.ORDER_RETENTION_CRON ?? '0 1 * * *')
    async run() {
        if (!this.enabled) {
            this.logger.debug('Job skipped (disabled)');
            return;
        }

        const retentionDays = Number(process.env.ORDER_RETENTION_DAYS ?? 180);
        const now = new Date();
        const cutoff = new Date(
            now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
        );

        this.logger.log(
            `Job started retentionDays=${retentionDays} cutoff=${cutoff.toISOString()}`,
        );

        /**
         * IMPORTANT:
         * Everything is done inside ONE transaction
         * to avoid races with:
         * - concurrent cron runs
         * - concurrent order creation
         */
        await this.prisma.transaction(async (tx) => {
            /**
             * 1️⃣ Fetch sequence state (FOR MEMORY)
             */
            const sequence = await tx.orderSequence.findUnique({
                where: { id: 1 },
                select: {
                    nextValue: true,
                    lastResetAt: true,
                },
            });

            if (!sequence) {
                throw new Error('orderSequence row missing (id=1)');
            }

            /**
             * 2️⃣ Find oldest ACTIVE order BEFORE retention
             */
            const oldestActiveOrder = await tx.order.findFirst({
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                select: { createdAt: true },
            });

            /**
             * 3️⃣ Determine whether we crossed the retention boundary
             *
             * Edge-triggered logic:
             * - oldestActive < cutoff
             * - AND we have NOT already reset for this oldest order
             */
            const shouldResetSequence =
                !!oldestActiveOrder &&
                oldestActiveOrder.createdAt < cutoff &&
                (!sequence.lastResetAt ||
                    sequence.lastResetAt < oldestActiveOrder.createdAt);

            /**
             * 4️⃣ Apply retention (soft delete)
             */
            const retentionResult = await tx.order.updateMany({
                where: {
                    deletedAt: null,
                    createdAt: { lt: cutoff },
                },
                data: { deletedAt: now },
            });

            /**
             * 5️⃣ Reset sequence ONCE per window
             */
            if (shouldResetSequence) {
                await tx.orderSequence.update({
                    where: { id: 1 },
                    data: {
                        nextValue: 1,
                        lastResetAt: now,
                    },
                });

                this.logger.warn(
                    `Order sequence reset (oldestActive=${oldestActiveOrder!.createdAt.toISOString()})`,
                );
            }

            this.logger.log(
                `Retention completed softDeleted=${retentionResult.count} reset=${shouldResetSequence}`,
            );
        });

        this.logger.log('Job completed successfully');
    }
}
