/**
 * Integration tests for generateFiscalCode.
 * Needs a PostgreSQL test DB (DATABASE_URL from .env.test).
 *   npm run db:test:push && npm run test:integration
 */
import { cleanDatabase } from '../../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../../test/prisma';
import { generateFiscalCode } from './fiscal-year.utils';

describe('generateFiscalCode (integration)', () => {
  const testPrisma = getTestPrisma();

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it('generates <prefix>1/YY-YY for the first code of a fiscal prefix', async () => {
    const code = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'ORD'));
    expect(code).toMatch(/^ORD1\/\d{2}-\d{2}$/);
  });

  it('increments the sequence counter on the second call for the same prefix', async () => {
    const first = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'ORD'));
    const second = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'ORD'));
    expect(second).toMatch(/^ORD2\/\d{2}-\d{2}$/);
    expect(first).not.toBe(second);
  });

  it('isolates sequences by prefix — R and ORD have independent counters', async () => {
    const ord1 = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'ORD'));
    const r1 = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'R'));
    const ord2 = await testPrisma.$transaction((tx) => generateFiscalCode(tx, 'ORD'));

    expect(ord1).toMatch(/^ORD1\//);
    expect(r1).toMatch(/^R1\//);
    expect(ord2).toMatch(/^ORD2\//);
  });

  it('concurrent calls with the same prefix each produce a unique code', async () => {
    // Prisma upsert with { increment: 1 } is atomic; PostgreSQL serialises the updates
    const results = await Promise.all([
      testPrisma.$transaction((tx) => generateFiscalCode(tx, 'CONC')),
      testPrisma.$transaction((tx) => generateFiscalCode(tx, 'CONC')),
      testPrisma.$transaction((tx) => generateFiscalCode(tx, 'CONC')),
    ]);

    const unique = new Set(results);
    expect(unique.size).toBe(3);
    for (const code of results) {
      expect(code).toMatch(/^CONC\d+\/\d{2}-\d{2}$/);
    }
  });
});
