import { Prisma } from '@prisma/client';

/**
 * Returns fiscal year in YY-YY format (India FY: Apr–Mar)
 * Example: 25-26
 */
export function getFiscalYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (month >= 4) {
        return `${year.toString().slice(-2)}-${(year + 1)
            .toString()
            .slice(-2)}`;
    }

    return `${(year - 1).toString().slice(-2)}-${year
        .toString()
        .slice(-2)}`;
}

/**
 * Generates fiscal sequential code like:
 * ORD1/25-26
 * R1/25-26
 *
 * Sequence is isolated per (prefix + fiscalYear)
 */
export async function generateFiscalCode(
    tx: Prisma.TransactionClient,
    prefix: string, // intentionally generic for future use
): Promise<string> {
    const fiscalYear = getFiscalYear();

    const seq = await tx.fiscalSequence.upsert({
        where: {
            prefix_fiscalYear: {
                prefix,
                fiscalYear,
            },
        },
        update: {
            nextValue: { increment: 1 },
        },
        create: {
            prefix,
            fiscalYear,
            nextValue: 2, // first issued value = 1
        },
        select: {
            nextValue: true,
        },
    });

    const value = seq.nextValue - 1;
    return `${prefix}${value}/${fiscalYear}`;
}
