/**
 * Integration tests for BillingSnapshotService.
 * Needs DATABASE_URL from .env.test → npm run test:integration
 */
import { BillingSnapshotIntent } from '@prisma/client';
import {
  cleanDatabase,
  seedCustomer,
  seedOrder,
  seedProcess,
  seedRunTemplate,
  seedSimpleWorkflow,
  seedUser,
} from '../../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../../test/prisma';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { FormulaCompiler } from '../formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../formula/math-only.formula.engine';
import { BillingCalculatorService } from './billing-calculator.service';
import { BillingContextResolver } from './billing-context.resolver';
import { BillingSnapshotService } from './billing-snapshot.service';

interface OrderScaffold {
  orderId: string;
  runId: string;
  customerId: string;
}

async function buildScaffold(
  testPrisma: ReturnType<typeof getTestPrisma>,
  opts: {
    suffix: string;
    formula?: string;
    runFields?: object;
    quantity?: number;
    customerOverrides?: { tax?: boolean; tds?: boolean };
  },
): Promise<OrderScaffold> {
  const { suffix, formula = 'quantity * new_rate', runFields = { new_rate: 50 }, quantity = 100 } =
    opts;

  const { wf: configWf } = await seedSimpleWorkflow(
    testPrisma,
    `BS_CFG_${suffix}`,
    ['CONFIGURE', 'COMPLETE'],
    [['CONFIGURE', 'COMPLETE']],
  );
  const { wf: lifecycleWf } = await seedSimpleWorkflow(
    testPrisma,
    `BS_LC_${suffix}`,
    ['DESIGN', 'COMPLETE'],
    [['DESIGN', 'COMPLETE']],
  );

  const template = await seedRunTemplate(testPrisma, {
    name: `BS Template ${suffix}`,
    billingFormula: formula,
    configWorkflowTypeId: configWf.id,
    lifecycleWorkflowTypeId: lifecycleWf.id,
  });

  const proc = await seedProcess(testPrisma, template.id, `BS Process ${suffix}`);

  const customer = await testPrisma.customer.create({
    data: {
      code: `BS_C_${suffix}`,
      name: `BS Customer ${suffix}`,
      creditLimit: 0,
      outstandingAmount: 0,
      tax: opts.customerOverrides?.tax ?? false,
      tds: opts.customerOverrides?.tds ?? false,
    },
  });

  const user = await seedUser(testPrisma, { email: `bs_${suffix}@test.com` });

  const order = await seedOrder(testPrisma, {
    customerId: customer.id,
    createdById: user.id,
    quantity,
    isTest: true,
  });

  const orderProcess = await testPrisma.orderProcess.create({
    data: { orderId: order.id, processId: proc.id, statusCode: 'CONFIGURE' },
  });

  const run = await testPrisma.processRun.create({
    data: {
      orderProcessId: orderProcess.id,
      runTemplateId: template.id,
      runNumber: 1,
      displayName: `BS Run ${suffix}`,
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWf.id,
      statusCode: 'CONFIGURE',
      lifeCycleStatusCode: 'DESIGN',
      fields: runFields,
    },
  });

  return { orderId: order.id, runId: run.id, customerId: customer.id };
}

describe('BillingSnapshotService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(prismaService, compiler, mathEngine);
  const contextResolver = new BillingContextResolver();
  const analyticsStub: any = { trackOrderFinalized: async () => {} };
  const ordersStub: any = {};
  const service = new BillingSnapshotService(
    prismaService,
    calculator,
    contextResolver,
    ordersStub,
    analyticsStub,
  );

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── finalizeOrder ─────────────────────────────────────────────────────────

  describe('finalizeOrder', () => {
    it('creates version 1 snapshot with correct result', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'FO1',
        // formula: quantity * new_rate, fields: { new_rate: 50 }, quantity: 100 → 5000
      });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(snapshot.version).toBe(1);
      expect(snapshot.isLatest).toBe(true);
      expect(snapshot.intent).toBe('FINAL');
      expect(Number(snapshot.result)).toBe(5000); // 100 * 50
    });

    it('auto-creates ORDER billing context if none exists', async () => {
      const { orderId } = await buildScaffold(testPrisma, { suffix: 'FO_AC' });

      await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const context = await testPrisma.billingContext.findFirst({
        where: { type: 'ORDER', orders: { some: { orderId } } },
      });
      expect(context).toBeTruthy();
    });

    it('flips isLatest on second finalizeOrder call', async () => {
      const { orderId } = await buildScaffold(testPrisma, { suffix: 'FO2' });

      const first = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      const second = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(second.version).toBe(2);
      expect(second.isLatest).toBe(true);

      const firstRefreshed = await testPrisma.billingSnapshot.findUnique({
        where: { id: first.id },
      });
      expect(firstRefreshed!.isLatest).toBe(false);
    });

    it('dynamic inputs override static run fields for calculation', async () => {
      const { orderId, runId } = await buildScaffold(testPrisma, {
        suffix: 'FO3',
        runFields: { new_rate: 50 }, // static: 50
      });

      // Override new_rate to 100
      const snapshot = await service.finalizeOrder(
        orderId,
        { [runId]: { new_rate: 100 } },
        BillingSnapshotIntent.FINAL,
      );

      expect(Number(snapshot.result)).toBe(10000); // 100 * 100
    });

    it('stores customer metadata in snapshot inputs', async () => {
      const { orderId } = await buildScaffold(testPrisma, { suffix: 'FO_META' });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const inputs = snapshot.inputs as any;
      expect(inputs.__CUSTOMER_METADATA__).toBeDefined();
      expect(inputs.__CUSTOMER_METADATA__.code).toBe('BS_C_FO_META');
    });

    it('stores TDS metadata in snapshot inputs', async () => {
      const { orderId } = await buildScaffold(testPrisma, { suffix: 'FO_TDS' });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const inputs = snapshot.inputs as any;
      expect(inputs.__TDS_METADATA__).toBeDefined();
      expect(typeof inputs.__TDS_METADATA__.tdsEnabled).toBe('boolean');
    });
  });

  // ── tax / TDS calculations ────────────────────────────────────────────────

  describe('tax and TDS', () => {
    it('applies 5% GST when customer tax=true', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'TAX',
        customerOverrides: { tax: true },
        // 100 * 50 = 5000 subtotal → 5% GST = 250 → finalAmount = 5250
      });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(snapshot.taxEnabled).toBe(true);
      expect(Number(snapshot.subTotalAmount)).toBe(5000);
      expect(Number(snapshot.taxPercentage)).toBe(5);
      expect(Number(snapshot.taxAmount)).toBe(250);
      expect(Number(snapshot.finalAmount)).toBe(5250);
    });

    it('does not apply tax when customer tax=false', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'NO_TAX',
        customerOverrides: { tax: false },
      });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(snapshot.taxEnabled).toBe(false);
      expect(Number(snapshot.taxAmount)).toBe(0);
      expect(Number(snapshot.finalAmount)).toBe(Number(snapshot.subTotalAmount));
    });

    it('applies 2% TDS deduction when customer tds=true', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'TDS',
        customerOverrides: { tds: true, tax: false },
        // 100 * 50 = 5000 subtotal → 2% TDS = 100 → finalAmount = 5000 - 100 = 4900
      });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(Number(snapshot.subTotalAmount)).toBe(5000);
      expect(Number(snapshot.finalAmount)).toBe(4900);

      const inputs = snapshot.inputs as any;
      expect(inputs.__TDS_METADATA__.tdsEnabled).toBe(true);
    });

    it('applies both tax (5%) and TDS (2%) when both enabled', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'TAX_TDS',
        customerOverrides: { tax: true, tds: true },
        // 5000 subtotal → tax=250 → tds=100 → final = 5000 + 250 - 100 = 5150
      });

      const snapshot = await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(Number(snapshot.subTotalAmount)).toBe(5000);
      expect(Number(snapshot.taxAmount)).toBe(250);
      expect(Number(snapshot.finalAmount)).toBe(5150);
    });
  });

  // ── createGroupSnapshot ───────────────────────────────────────────────────

  describe('createGroupSnapshot', () => {
    it('creates a GROUP snapshot summing per-order results', async () => {
      const { orderId: orderId1 } = await buildScaffold(testPrisma, {
        suffix: 'GS1',
        runFields: { new_rate: 30 }, // 100 * 30 = 3000
      });
      const { orderId: orderId2 } = await buildScaffold(testPrisma, {
        suffix: 'GS2',
        runFields: { new_rate: 20 }, // 100 * 20 = 2000
      });

      // Finalize both orders individually first
      await service.finalizeOrder(orderId1, {}, BillingSnapshotIntent.FINAL);
      await service.finalizeOrder(orderId2, {}, BillingSnapshotIntent.FINAL);

      // Create GROUP billing context
      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR0001',
          orders: {
            createMany: {
              data: [{ orderId: orderId1 }, { orderId: orderId2 }],
            },
          },
        },
      });

      const groupSnapshot = await service.createGroupSnapshot(groupContext.id);

      expect(groupSnapshot.version).toBe(1);
      expect(groupSnapshot.isLatest).toBe(true);
      expect(groupSnapshot.intent).toBe('FINAL');
      expect(Number(groupSnapshot.result)).toBe(5000); // 3000 + 2000
    });

    it('second group snapshot increments version correctly', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'GS_V2',
        runFields: { new_rate: 40 }, // 100 * 40 = 4000
      });

      await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR0002',
          orders: { create: { orderId } },
        },
      });

      const first = await service.createGroupSnapshot(groupContext.id);
      const second = await service.createGroupSnapshot(groupContext.id);

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
      expect(second.isLatest).toBe(true);

      // GROUP snapshots use version-ordering (not isLatest flip) to determine latest
      const allSnapshots = await testPrisma.billingSnapshot.findMany({
        where: { billingContextId: groupContext.id },
        orderBy: { version: 'asc' },
      });
      expect(allSnapshots).toHaveLength(2);
      expect(allSnapshots[1].version).toBe(2);
    });

    it('throws when GROUP context has no orders', async () => {
      const groupContext = await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'TESTR_EMPTY' },
      });

      await expect(service.createGroupSnapshot(groupContext.id)).rejects.toThrow(
        'Cannot create group snapshot without orders',
      );
    });

    it('throws when an order has no FINAL snapshot', async () => {
      const customer = await seedCustomer(testPrisma, { code: 'GS_NO_SNAP', name: 'No Snap' });
      const user = await seedUser(testPrisma, { email: 'gsnap@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
      });

      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR_MISSING',
          orders: { create: { orderId: order.id } },
        },
      });

      await expect(service.createGroupSnapshot(groupContext.id)).rejects.toThrow(
        /Missing FINAL snapshot/,
      );
    });
  });

  // ── getLatestSnapshot ────────────────────────────────────────────────────

  describe('getLatestSnapshot', () => {
    it('returns latest snapshot by orderId', async () => {
      const { orderId } = await buildScaffold(testPrisma, {
        suffix: 'GLS',
        runFields: { new_rate: 25 }, // 100 * 25 = 2500
      });

      await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const result = await service.getLatestSnapshot({ orderId });

      expect(result.type).toBe('ORDER');
      expect(result.result).toBe('2500');
      expect(result.isLatest).toBe(true);
      expect(result.intent).toBe('FINAL');
    });

    it('returns latest snapshot by billingContextId', async () => {
      const { orderId } = await buildScaffold(testPrisma, { suffix: 'GLS_CTX' });

      await service.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const context = await testPrisma.billingContext.findFirst({
        where: { type: 'ORDER', orders: { some: { orderId } } },
      });

      const result = await service.getLatestSnapshot({ billingContextId: context!.id });

      expect(result.billingContextId).toBe(context!.id);
      expect(result.isLatest).toBe(true);
    });
  });
});
