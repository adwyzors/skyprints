/**
 * Cross-module E2E integration tests.
 * Covers: user-context enforcement, credit-limit flows, transaction atomicity,
 * full order lifecycle (including IN_PRODUCTION/COMPLETE), BillingContextService
 * group flow, multi-run estimate aggregation, and failure/edge scenarios.
 * Needs DATABASE_URL from .env.test → npm run test:integration
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BillingSnapshotIntent } from '@prisma/client';
import {
  cleanDatabase,
  seedCustomer,
  seedProcess,
  seedRunTemplate,
  seedSimpleWorkflow,
  seedUser,
} from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextStore } from '../common/context/request-context.store';
import { FormulaCompiler } from '../billing/formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../billing/formula/math-only.formula.engine';
import { BillingCalculatorService } from '../billing/services/billing-calculator.service';
import { BillingContextResolver } from '../billing/services/billing-context.resolver';
import { BillingContextService } from '../billing/services/billing-context.service';
import { BillingSnapshotService } from '../billing/services/billing-snapshot.service';
import { RunFieldsValidator } from '../runs/run-fields.validator';
import { RunsService } from '../runs/runs.service';
import { OrdersService } from './orders.service';

const cloudflareStub: any = {
  isValidImageUrl: () => true,
  deleteImage: async () => {},
  deleteFiles: async () => {},
};
const analyticsStub: any = { trackOrderFinalized: async () => {} };

function buildServices() {
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(prismaService, compiler, mathEngine);
  const contextResolver = new BillingContextResolver();
  const snapshotService = new BillingSnapshotService(
    prismaService,
    calculator,
    contextResolver,
    {} as any,
    analyticsStub,
  );
  const contextService = new BillingContextService(prismaService, snapshotService, calculator);
  const ordersService = new OrdersService(prismaService, cloudflareStub, calculator);
  const validator = new RunFieldsValidator();
  const runsService = new RunsService(prismaService, validator, calculator);
  return { prismaService, ordersService, snapshotService, contextService, runsService };
}

describe('Cross-module E2E (integration)', () => {
  const testPrisma = getTestPrisma();
  const { prismaService, ordersService, snapshotService, contextService, runsService } =
    buildServices();

  async function withUser<T>(userId: string, email: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { correlationId: 'xm-test', user: { id: userId, email, permissions: [], roles: ['ADMIN'] } },
      fn,
    );
  }

  async function buildScaffold(suffix: string, formula = 'quantity * new_rate') {
    const { wf: configWf } = await seedSimpleWorkflow(
      testPrisma,
      `XM_CFG_${suffix}`,
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );
    const { wf: lifecycleWf } = await seedSimpleWorkflow(
      testPrisma,
      `XM_LC_${suffix}`,
      ['DESIGN', 'COMPLETE'],
      [['DESIGN', 'COMPLETE']],
    );
    const template = await seedRunTemplate(testPrisma, {
      name: `XM Template ${suffix}`,
      billingFormula: formula,
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWf.id,
    });
    const proc = await seedProcess(testPrisma, template.id, `XM Process ${suffix}`);
    const customer = await seedCustomer(testPrisma, {
      code: `XMC${suffix}`,
      name: `XM Customer ${suffix}`,
    });
    const user = await seedUser(testPrisma, { email: `xm_${suffix}@test.com` });
    return { configWf, lifecycleWf, template, proc, customer, user };
  }

  async function createOrder(
    userId: string,
    email: string,
    customerId: string,
    processId: string,
    opts: { quantity?: number; count?: number; isTest?: boolean } = {},
  ): Promise<string> {
    const { quantity = 100, count = 1, isTest = true } = opts;
    let orderId!: string;
    await withUser(userId, email, async () => {
      const r = await ordersService.create({
        customerId,
        quantity,
        processes: [{ processId, count }],
        isTest,
      } as any);
      orderId = r!.id;
    });
    return orderId;
  }

  async function setRunFields(orderId: string, fields: object) {
    await testPrisma.processRun.updateMany({
      where: { orderProcess: { orderId } },
      data: { fields },
    });
  }

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── Permission: user-context enforcement ─────────────────────────────────────

  describe('Permission — user context enforcement', () => {
    it('create throws "User context missing" when called outside RequestContextStore', async () => {
      const { proc, customer } = await buildScaffold('P01');
      await expect(
        ordersService.create({
          customerId: customer.id,
          quantity: 10,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: true,
        } as any),
      ).rejects.toThrow('User context missing');
    });

    it('reorder throws "User context missing" when called outside RequestContextStore', async () => {
      const { proc, customer, user } = await buildScaffold('P02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      await expect(ordersService.reorder(orderId)).rejects.toThrow('User context missing');
    });

    it('updateBasicDetails throws "User context missing" when called outside RequestContextStore', async () => {
      const { proc, customer, user } = await buildScaffold('P03');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      await expect(
        ordersService.updateBasicDetails(orderId, { quantity: 50 } as any),
      ).rejects.toThrow('User context missing');
    });

    it('addProcessToOrder throws "User context missing" when called outside RequestContextStore', async () => {
      const { proc, customer, user } = await buildScaffold('P04');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      await expect(
        ordersService.addProcessToOrder(orderId, { processId: proc.id, count: 1 }),
      ).rejects.toThrow('User context missing');
    });

    it('create succeeds even with minimal roles when RequestContextStore is set', async () => {
      const { proc, customer, user } = await buildScaffold('P05');
      let orderId: string | undefined;
      await RequestContextStore.run(
        {
          correlationId: 'guest-test',
          user: { id: user.id, email: user.email, permissions: [], roles: ['GUEST'] },
        },
        async () => {
          const r = await ordersService.create({
            customerId: customer.id,
            quantity: 10,
            processes: [{ processId: proc.id, count: 1 }],
            isTest: true,
          } as any);
          orderId = r?.id;
        },
      );
      expect(orderId).toBeDefined();
    });
  });

  // ── Credit limit enforcement across module boundaries ─────────────────────────
  // Note: validateCreditLimit only counts isTest:false orders in CONFIGURE status.

  describe('Credit limit — cross-module enforcement', () => {
    it('blocks order creation when existing CONFIGURE orders already hit the credit limit', async () => {
      const { proc, user } = await buildScaffold('CL01');
      const customer = await testPrisma.customer.create({
        data: { code: 'CLCUST01', name: 'CL Customer 01', creditLimit: 5000, outstandingAmount: 0 },
      });

      // Create a non-test order in CONFIGURE — it counts toward credit exposure
      const orderId1 = await createOrder(user.id, user.email, customer.id, proc.id, {
        isTest: false,
      });
      // Manually set estimatedAmount so exposure equals the limit
      await testPrisma.order.update({
        where: { id: orderId1 },
        data: { estimatedAmount: 5000 },
      });

      // Second non-test order: exposure = 0 (outstanding) + 5000 (order1 CONFIGURE) = 5000 >= 5000
      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.create({
            customerId: customer.id,
            quantity: 50,
            processes: [{ processId: proc.id, count: 1 }],
            isTest: false,
          } as any),
        ).rejects.toThrow('Credit limit reached');
      });
    });

    it('PRODUCTION_READY moves exposure to outstanding, clearing CONFIGURE budget', async () => {
      const { proc, user } = await buildScaffold('CL02');
      const customer = await testPrisma.customer.create({
        data: { code: 'CLCUST02', name: 'CL Customer 02', creditLimit: 5000, outstandingAmount: 0 },
      });

      const orderId1 = await createOrder(user.id, user.email, customer.id, proc.id, {
        isTest: false,
      });
      await testPrisma.order.update({ where: { id: orderId1 }, data: { estimatedAmount: 5000 } });

      // Blocked while order1 is CONFIGURE
      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.create({
            customerId: customer.id,
            quantity: 10,
            processes: [{ processId: proc.id, count: 1 }],
            isTest: false,
          } as any),
        ).rejects.toThrow('Credit limit reached');
      });

      // setProductionReady recomputes estimate from run fields (→ 0 since unset) and moves
      // the order out of CONFIGURE; outstanding gets incremented by the recomputed amount (0)
      await setRunFields(orderId1, { 'Estimated Amount': 0, new_rate: 0 });
      await ordersService.setProductionReady(orderId1);

      // CONFIGURE exposure = 0, outstanding = 0 → new order passes
      let orderId2: string | undefined;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.create({
          customerId: customer.id,
          quantity: 10,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: false,
        } as any);
        orderId2 = r!.id;
      });
      expect(orderId2).toBeDefined();
    });

    it('credit limit = 0 means unlimited — never blocks regardless of outstanding', async () => {
      const { proc, user } = await buildScaffold('CL03');
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CLCUST03',
          name: 'Unlimited Customer',
          creditLimit: 0,
          outstandingAmount: 99999,
        },
      });

      let orderId!: string;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.create({
          customerId: customer.id,
          quantity: 1000,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: false,
        } as any);
        orderId = r!.id;
      });
      expect(orderId).toBeDefined();
    });

    it('test orders (isTest:true) are never counted in credit limit exposure', async () => {
      const { proc, user } = await buildScaffold('CL04');
      const customer = await testPrisma.customer.create({
        data: { code: 'CLCUST04', name: 'CL Customer 04', creditLimit: 100, outstandingAmount: 0 },
      });

      // Create test orders whose estimates would exceed the limit if counted
      for (let i = 0; i < 5; i++) {
        const o = await createOrder(user.id, user.email, customer.id, proc.id, { isTest: true });
        await testPrisma.order.update({ where: { id: o }, data: { estimatedAmount: 50 } });
      }

      // A non-test order should pass since test orders are excluded from credit exposure
      let orderId: string | undefined;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.create({
          customerId: customer.id,
          quantity: 1,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: false,
        } as any);
        orderId = r?.id;
      });
      expect(orderId).toBeDefined();
    });
  });

  // ── Transaction atomicity — failed creates leave no partial data ──────────────

  describe('Transaction atomicity — no partial state on failure', () => {
    it('no Order row is created when a process is disabled', async () => {
      const { proc, customer, user } = await buildScaffold('AT01');
      await testPrisma.process.update({ where: { id: proc.id }, data: { isEnabled: false } });

      const beforeCount = await testPrisma.order.count({ where: { customerId: customer.id } });

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.create({
            customerId: customer.id,
            quantity: 10,
            processes: [{ processId: proc.id, count: 1 }],
            isTest: true,
          } as any),
        ).rejects.toThrow();
      });

      expect(await testPrisma.order.count({ where: { customerId: customer.id } })).toBe(beforeCount);
    });

    it('no Order, OrderProcess, or ProcessRun rows created when process id is invalid', async () => {
      const { customer, user } = await buildScaffold('AT02');

      const beforeOrders = await testPrisma.order.count();
      const beforeProcesses = await testPrisma.orderProcess.count();
      const beforeRuns = await testPrisma.processRun.count();

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.create({
            customerId: customer.id,
            quantity: 10,
            processes: [{ processId: '00000000-0000-0000-0000-000000000099', count: 1 }],
            isTest: true,
          } as any),
        ).rejects.toThrow();
      });

      expect(await testPrisma.order.count()).toBe(beforeOrders);
      expect(await testPrisma.orderProcess.count()).toBe(beforeProcesses);
      expect(await testPrisma.processRun.count()).toBe(beforeRuns);
    });

    it('no Order row is created when customer does not exist', async () => {
      const { proc, user } = await buildScaffold('AT03');
      const beforeCount = await testPrisma.order.count();

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.create({
            customerId: '00000000-0000-0000-0000-000000000099',
            quantity: 10,
            processes: [{ processId: proc.id, count: 1 }],
            isTest: true,
          } as any),
        ).rejects.toThrow();
      });

      expect(await testPrisma.order.count()).toBe(beforeCount);
    });
  });

  // ── Full lifecycle: CONFIGURE → PRODUCTION_READY → IN_PRODUCTION → COMPLETE ──

  describe('Full order lifecycle including IN_PRODUCTION and COMPLETE states', () => {
    it('chains all status transitions and verifies counters at each step', async () => {
      const { proc, customer, user } = await buildScaffold('LC01');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      expect((await testPrisma.order.findUnique({ where: { id: orderId } }))!.statusCode).toBe(
        'CONFIGURE',
      );

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const atPR = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(atPR!.statusCode).toBe('PRODUCTION_READY');
      expect(Number((await testPrisma.customer.findUnique({ where: { id: customer.id } }))!.outstandingAmount)).toBe(5000);

      await ordersService.startProduction(orderId);
      expect((await testPrisma.order.findUnique({ where: { id: orderId } }))!.statusCode).toBe(
        'IN_PRODUCTION',
      );

      await ordersService.completeProduction(orderId);
      const atComplete = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(atComplete!.statusCode).toBe('COMPLETE');
      expect(atComplete!.completedProcesses).toBe(atComplete!.totalProcesses);

      const op = await testPrisma.orderProcess.findFirst({ where: { orderId } });
      expect(op!.statusCode).toBe('COMPLETE');
      expect(op!.lifecycleCompletedRuns).toBe(op!.totalRuns);
    });

    it('completeProduction throws BadRequestException when order is not IN_PRODUCTION', async () => {
      const { proc, customer, user } = await buildScaffold('LC02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await expect(ordersService.completeProduction(orderId)).rejects.toThrow(BadRequestException);

      expect((await testPrisma.order.findUnique({ where: { id: orderId } }))!.statusCode).toBe(
        'CONFIGURE',
      );
    });

    it('setProductionReady throws NotFoundException for a non-existent order', async () => {
      await expect(
        ordersService.setProductionReady('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(NotFoundException);
    });

    it('startProduction throws NotFoundException for a non-existent order', async () => {
      await expect(
        ordersService.startProduction('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(NotFoundException);
    });

    it('outstanding is correct after full CONFIGURE → COMPLETE → BILLED chain', async () => {
      const { proc, customer, user } = await buildScaffold('LC03');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);
      await ordersService.startProduction(orderId);
      await ordersService.completeProduction(orderId);

      const snapshot = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      expect(Number(snapshot.result)).toBe(5000);

      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(5000); // actual = estimate, no diff

      const order = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(order!.statusCode).toBe('BILLED');
    });
  });

  // ── Multi-run estimate aggregation via RunsService ────────────────────────────

  describe('RunsService — multi-run estimate aggregation', () => {
    it('order estimatedAmount equals sum of Estimated Amount fields across all runs', async () => {
      const { proc, customer, user } = await buildScaffold('MR01');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id, { count: 2 });

      const runs = await testPrisma.processRun.findMany({
        where: { orderProcess: { orderId } },
        orderBy: { runNumber: 'asc' },
      });
      expect(runs.length).toBe(2);

      // Update run 1 directly (does not trigger recompute)
      await testPrisma.processRun.update({
        where: { id: runs[0].id },
        data: { fields: { 'Estimated Amount': 3000, new_rate: 30 } },
      });

      // Update run 2 via RunsService — triggers recomputeOrderEstimate (3000 + 2000 = 5000)
      await runsService.update(
        prismaService,
        runs[1].id,
        { fields: { 'Estimated Amount': 2000, new_rate: 20 } },
        orderId,
      );

      const order = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(Number(order!.estimatedAmount)).toBe(5000);
    });

    it('RunsService.update recalculates estimate when a run field changes', async () => {
      const { proc, customer, user } = await buildScaffold('MR02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      const run = await testPrisma.processRun.findFirst({ where: { orderProcess: { orderId } } });

      await runsService.update(
        prismaService,
        run!.id,
        { fields: { 'Estimated Amount': 4000, new_rate: 40 } },
        orderId,
      );
      expect(Number((await testPrisma.order.findUnique({ where: { id: orderId } }))!.estimatedAmount)).toBe(4000);

      await runsService.update(
        prismaService,
        run!.id,
        { fields: { 'Estimated Amount': 7500, new_rate: 75 } },
        orderId,
      );
      expect(Number((await testPrisma.order.findUnique({ where: { id: orderId } }))!.estimatedAmount)).toBe(7500);
    });

    it('RunsService.get throws BadRequestException for unknown run id', async () => {
      const { proc, customer, user } = await buildScaffold('MR03');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      const op = await testPrisma.orderProcess.findFirst({ where: { orderId } });

      await expect(
        runsService.get(orderId, op!.id, '00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── BillingContextService + BillingSnapshotService group flow ────────────────

  describe('BillingContextService — full group billing flow', () => {
    it('creating a GROUP context with orderIds auto-generates a group snapshot', async () => {
      const { proc, customer, user } = await buildScaffold('BC01');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 3000, new_rate: 30 });
      await ordersService.setProductionReady(orderId);
      // Creates ORDER billing context + FINAL snapshot (required by createGroupSnapshotTx)
      await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const ctx = await contextService.create({
        type: 'GROUP',
        isTest: true,
        orderIds: [orderId],
      } as any);

      expect(ctx.type).toBe('GROUP');
      expect(ctx.name).toMatch(/^TESTR/);

      const snap = await testPrisma.billingSnapshot.findFirst({
        where: { billingContextId: ctx.id, intent: 'FINAL' },
      });
      expect(snap).not.toBeNull();
      expect(Number(snap!.result)).toBe(3000);
    });

    it('addOrders links new orders to an existing context', async () => {
      const { proc, customer, user } = await buildScaffold('BC02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      const ctx = await contextService.create({ type: 'ORDER', name: 'BC02 Context' } as any);
      const result = await contextService.addOrders(ctx.id, [orderId]);
      expect(result.added).toBe(1);

      expect(
        await testPrisma.billingContextOrder.findFirst({ where: { billingContextId: ctx.id, orderId } }),
      ).not.toBeNull();
    });

    it('addOrders is idempotent — adding the same order twice does not duplicate', async () => {
      const { proc, customer, user } = await buildScaffold('BC03');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      const ctx = await contextService.create({ type: 'ORDER', name: 'BC03 Context' } as any);
      await contextService.addOrders(ctx.id, [orderId]);
      const second = await contextService.addOrders(ctx.id, [orderId]);
      expect(second.added).toBe(0);

      const links = await testPrisma.billingContextOrder.findMany({
        where: { billingContextId: ctx.id, orderId },
      });
      expect(links.length).toBe(1);
    });

    it('removeOrder unlinks an order without deleting the context or the order', async () => {
      const { proc, customer, user } = await buildScaffold('BC04');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      const ctx = await testPrisma.billingContext.create({
        data: { type: 'ORDER', name: 'BC04_CTX', orders: { create: { orderId } } },
      });

      await contextService.removeOrder(ctx.id, orderId);

      expect(
        await testPrisma.billingContextOrder.findFirst({ where: { billingContextId: ctx.id, orderId } }),
      ).toBeNull();
      expect(await testPrisma.billingContext.findUnique({ where: { id: ctx.id } })).not.toBeNull();
      expect(await testPrisma.order.findUnique({ where: { id: orderId } })).not.toBeNull();
    });

    it('getContextById throws BadRequestException for a non-existent context', async () => {
      await expect(
        contextService.getContextById('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── BillingSnapshotService failure scenarios ──────────────────────────────────

  describe('BillingSnapshotService — failure and edge scenarios', () => {
    it('finalizeOrder with a zero-result formula creates a snapshot with result = 0', async () => {
      const { proc, customer, user } = await buildScaffold('BS01', 'quantity * zero_rate');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      await setRunFields(orderId, { 'Estimated Amount': 0, zero_rate: 0 });

      const snapshot = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      expect(Number(snapshot.result)).toBe(0);
      expect(snapshot.version).toBe(1);

      const cust = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(cust!.outstandingAmount)).toBe(0);
    });

    it('createGroupSnapshot throws when GROUP context has no orders', async () => {
      const ctx = await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'EMPTY_GRP_XM' },
      });
      await expect(snapshotService.createGroupSnapshot(ctx.id)).rejects.toThrow(
        'Cannot create group snapshot without orders',
      );
    });

    it('createGroupSnapshot throws when an order has no FINAL snapshot', async () => {
      const { proc, customer, user } = await buildScaffold('BS02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      const ctx = await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'NO_SNAP_GRP', orders: { create: { orderId } } },
      });

      await expect(snapshotService.createGroupSnapshot(ctx.id)).rejects.toThrow(
        /Missing FINAL snapshot/,
      );
    });

    it('getLatestSnapshot throws "Billing context not found" for non-existent context', async () => {
      await expect(
        snapshotService.getLatestSnapshot({ billingContextId: '00000000-0000-0000-0000-000000000099' }),
      ).rejects.toThrow('Billing context not found');
    });

    it('getLatestSnapshot throws "No snapshot found" for a context with no snapshots', async () => {
      const ctx = await testPrisma.billingContext.create({
        data: { type: 'ORDER', name: 'NO_SNAP_XM' },
      });
      await expect(
        snapshotService.getLatestSnapshot({ billingContextId: ctx.id }),
      ).rejects.toThrow('No snapshot found');
    });

    it('second finalizeOrder call creates version 2 and flips isLatest on version 1', async () => {
      const { proc, customer, user } = await buildScaffold('BS03');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);
      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });

      const v1 = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      expect(v1.version).toBe(1);
      expect(v1.isLatest).toBe(true);

      const v2 = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      expect(v2.version).toBe(2);
      expect(v2.isLatest).toBe(true);

      const v1Refreshed = await testPrisma.billingSnapshot.findUnique({ where: { id: v1.id } });
      expect(v1Refreshed!.isLatest).toBe(false);
    });
  });

  // ── deleteBulk edge scenarios ─────────────────────────────────────────────────

  describe('deleteBulk — edge scenarios', () => {
    it('is idempotent — already soft-deleted orders are not double-counted', async () => {
      const { proc, customer, user } = await buildScaffold('DB01');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await ordersService.delete(orderId);
      const firstDeletedAt = (await testPrisma.order.findUnique({ where: { id: orderId } }))!
        .deletedAt;

      const result = await ordersService.deleteBulk([orderId]);
      expect(result.count).toBe(0);

      const afterBulk = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(afterBulk!.deletedAt).toEqual(firstDeletedAt);
    });

    it('partially succeeds — deletes the valid order and ignores a non-existent id', async () => {
      const { proc, customer, user } = await buildScaffold('DB02');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      const result = await ordersService.deleteBulk([
        orderId,
        '00000000-0000-0000-0000-000000000099',
      ]);
      expect(result.count).toBe(1);

      const order = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(order!.deletedAt).not.toBeNull();
    });

    it('empty id list returns success with count = 0', async () => {
      const result = await ordersService.deleteBulk([]);
      expect(result).toMatchObject({ count: 0 });
    });
  });

  // ── Fiscal sequence integrity ─────────────────────────────────────────────────

  describe('Fiscal sequence — uniqueness across multiple creates', () => {
    it('two orders created sequentially get distinct codes', async () => {
      const { proc, customer, user } = await buildScaffold('FS01');
      let code1!: string, code2!: string;

      await withUser(user.id, user.email, async () => {
        const r1 = await ordersService.create({
          customerId: customer.id,
          quantity: 10,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: true,
        } as any);
        code1 = r1!.code;

        const r2 = await ordersService.create({
          customerId: customer.id,
          quantity: 10,
          processes: [{ processId: proc.id, count: 1 }],
          isTest: true,
        } as any);
        code2 = r2!.code;
      });

      expect(code1).not.toBe(code2);
      expect(code1).toMatch(/^TESTORD\d+\/\d{2}-\d{2}$/);
      expect(code2).toMatch(/^TESTORD\d+\/\d{2}-\d{2}$/);
    });

    it('reorder generates a new code distinct from the source order', async () => {
      const { proc, customer, user } = await buildScaffold('FS02');
      const sourceOrderId = await createOrder(user.id, user.email, customer.id, proc.id);
      const sourceOrder = await testPrisma.order.findUnique({ where: { id: sourceOrderId } });

      let newOrderId!: string;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.reorder(sourceOrderId);
        newOrderId = r!.id;
      });

      const newOrder = await testPrisma.order.findUnique({ where: { id: newOrderId } });
      expect(newOrder!.code).not.toBe(sourceOrder!.code);
      expect(newOrder!.code).toMatch(/^TESTORD/);
    });
  });

  // ── OrdersService.getAll filtering ────────────────────────────────────────────

  describe('OrdersService.getAll — filtering', () => {
    it('excludes soft-deleted orders from results', async () => {
      const { proc, customer, user } = await buildScaffold('GA01');

      const orderId1 = await createOrder(user.id, user.email, customer.id, proc.id, { quantity: 10 });
      const orderId2 = await createOrder(user.id, user.email, customer.id, proc.id, { quantity: 20 });

      await ordersService.delete(orderId1);

      const result = await ordersService.getAll({ isTest: true, page: 1, limit: 12 } as any);
      const ids = result.data.map((o: any) => o.id);
      expect(ids).not.toContain(orderId1);
      expect(ids).toContain(orderId2);
    });

    it('returns empty data and meta.total = 0 when search matches nothing', async () => {
      const result = await ordersService.getAll({
        isTest: true,
        search: 'NOMATCH_ZZZZ99',
        page: 1,
        limit: 12,
      } as any);
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('getById throws NotFoundException for a non-existent order id', async () => {
      await expect(
        ordersService.getById('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
