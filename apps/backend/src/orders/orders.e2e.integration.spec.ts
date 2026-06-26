/**
 * End-to-end integration tests covering the full order lifecycle.
 * Each scenario chains multiple services to test real business flows.
 * Needs a PostgreSQL test DB (DATABASE_URL from .env.test).
 *   npm run db:test:push && npm run test:integration
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
import { BillingSnapshotService } from '../billing/services/billing-snapshot.service';
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
  const ordersService = new OrdersService(prismaService, cloudflareStub, calculator);
  const snapshotService = new BillingSnapshotService(
    prismaService,
    calculator,
    contextResolver,
    {} as any,
    analyticsStub,
  );
  return { ordersService, snapshotService };
}

describe('Order lifecycle E2E (integration)', () => {
  const testPrisma = getTestPrisma();
  const { ordersService, snapshotService } = buildServices();

  async function withUser<T>(
    userId: string,
    email: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return RequestContextStore.run(
      {
        correlationId: 'e2e-test',
        user: { id: userId, email, permissions: [], roles: ['ADMIN'] },
      },
      fn,
    );
  }

  async function buildScaffold(suffix: string, formula = 'quantity * new_rate') {
    const { wf: configWf } = await seedSimpleWorkflow(
      testPrisma,
      `E2E_CFG_${suffix}`,
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );
    const { wf: lifecycleWf } = await seedSimpleWorkflow(
      testPrisma,
      `E2E_LC_${suffix}`,
      ['DESIGN', 'COMPLETE'],
      [['DESIGN', 'COMPLETE']],
    );
    const template = await seedRunTemplate(testPrisma, {
      name: `E2E Template ${suffix}`,
      billingFormula: formula,
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWf.id,
    });
    const proc = await seedProcess(testPrisma, template.id, `E2E Process ${suffix}`);
    const customer = await seedCustomer(testPrisma, {
      code: `E2EC${suffix}`,
      name: `E2E Customer ${suffix}`,
    });
    const user = await seedUser(testPrisma, { email: `e2e_${suffix}@test.com` });
    return { configWf, lifecycleWf, template, proc, customer, user };
  }

  async function createOrder(
    userId: string,
    email: string,
    customerId: string,
    processId: string,
    quantity = 100,
  ): Promise<string> {
    let orderId!: string;
    await withUser(userId, email, async () => {
      const result = await ordersService.create({
        customerId,
        quantity,
        processes: [{ processId, count: 1 }],
        isTest: true,
      } as any);
      orderId = result!.id;
    });
    return orderId;
  }

  async function setRunFields(orderId: string, fields: object) {
    const run = await testPrisma.processRun.findFirst({
      where: { orderProcess: { orderId } },
    });
    await testPrisma.processRun.update({
      where: { id: run!.id },
      data: { fields },
    });
    return run!;
  }

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── E2E-01: Full single-order lifecycle ──────────────────────────────────────

  describe('E2E-01 — full single-order lifecycle (CONFIGURE → PRODUCTION_READY → BILLED)', () => {
    it('transitions through full lifecycle; outstanding unchanged when actual equals estimate', async () => {
      const { proc, customer, user } = await buildScaffold('01A');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });

      await ordersService.setProductionReady(orderId);

      const afterPR = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(afterPR!.statusCode).toBe('PRODUCTION_READY');
      expect(Number(afterPR!.estimatedAmount)).toBe(5000);

      const custAfterPR = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custAfterPR!.outstandingAmount)).toBe(5000);

      const snapshot = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);
      expect(snapshot.version).toBe(1);
      expect(snapshot.isLatest).toBe(true);
      expect(Number(snapshot.result)).toBe(5000);

      const afterBilled = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(afterBilled!.statusCode).toBe('BILLED');

      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(5000);
    });

    it('outstanding is adjusted upward when actual billing amount exceeds the estimate', async () => {
      const { proc, customer, user } = await buildScaffold('01B');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      // Estimated Amount = 3000 but formula evaluates to 100 * 50 = 5000
      await setRunFields(orderId, { 'Estimated Amount': 3000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(3000);

      await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      // actual(5000) - estimate(3000) = +2000 added to outstanding
      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(5000);
    });

    it('outstanding is adjusted downward when actual billing amount is less than the estimate', async () => {
      const { proc, customer, user } = await buildScaffold('01C');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      // Estimated Amount = 8000 but formula evaluates to 100 * 50 = 5000
      await setRunFields(orderId, { 'Estimated Amount': 8000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(8000);

      await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      // actual(5000) - estimate(8000) = -3000 deducted from outstanding
      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(5000);
    });
  });

  // ── E2E-02: Multi-order group invoice ────────────────────────────────────────

  describe('E2E-02 — multi-order group invoice', () => {
    it('group snapshot sums both orders and transitions both to GROUP_BILLED, zeroing outstanding', async () => {
      const { proc: proc1, customer, user } = await buildScaffold('02A');

      // Second process for the same customer
      const { wf: configWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_CFG_02B',
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_LC_02B',
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );
      const template2 = await seedRunTemplate(testPrisma, {
        name: 'E2E Template 02B',
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf2.id,
        lifecycleWorkflowTypeId: lifecycleWf2.id,
      });
      const proc2 = await seedProcess(testPrisma, template2.id, 'E2E Process 02B');

      let orderId1!: string;
      let orderId2!: string;
      await withUser(user.id, user.email, async () => {
        const r1 = await ordersService.create({
          customerId: customer.id,
          quantity: 100,
          processes: [{ processId: proc1.id, count: 1 }],
          isTest: true,
        } as any);
        orderId1 = r1!.id;

        const r2 = await ordersService.create({
          customerId: customer.id,
          quantity: 100,
          processes: [{ processId: proc2.id, count: 1 }],
          isTest: true,
        } as any);
        orderId2 = r2!.id;
      });

      await setRunFields(orderId1, { 'Estimated Amount': 3000, new_rate: 30 });
      await setRunFields(orderId2, { 'Estimated Amount': 2000, new_rate: 20 });

      await ordersService.setProductionReady(orderId1);
      await ordersService.setProductionReady(orderId2);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(5000);

      await snapshotService.finalizeOrder(orderId1, {}, BillingSnapshotIntent.FINAL);
      await snapshotService.finalizeOrder(orderId2, {}, BillingSnapshotIntent.FINAL);

      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR0001',
          isTest: true,
          orders: {
            createMany: { data: [{ orderId: orderId1 }, { orderId: orderId2 }] },
          },
        },
      });

      const groupSnapshot = await snapshotService.createGroupSnapshot(groupContext.id);

      expect(groupSnapshot.version).toBe(1);
      expect(groupSnapshot.isLatest).toBe(true);
      expect(Number(groupSnapshot.result)).toBe(5000); // 3000 + 2000

      const o1 = await testPrisma.order.findUnique({ where: { id: orderId1 } });
      const o2 = await testPrisma.order.findUnique({ where: { id: orderId2 } });
      expect(o1!.statusCode).toBe('GROUP_BILLED');
      expect(o2!.statusCode).toBe('GROUP_BILLED');

      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(0);
    });

    it('second group snapshot increments version without re-adjusting outstanding', async () => {
      const { proc, customer, user } = await buildScaffold('02V2');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 4000, new_rate: 40 });
      await ordersService.setProductionReady(orderId);
      await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR0002',
          isTest: true,
          orders: { create: { orderId } },
        },
      });

      const first = await snapshotService.createGroupSnapshot(groupContext.id);
      const second = await snapshotService.createGroupSnapshot(groupContext.id);

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
      expect(second.isLatest).toBe(true);

      // Outstanding was already zeroed by the first group snapshot; second does not re-reduce
      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(0);
    });
  });

  // ── E2E-03: Edit PRODUCTION_READY → reverts to CONFIGURE ─────────────────────

  describe('E2E-03 — updateBasicDetails reverts PRODUCTION_READY order to CONFIGURE', () => {
    it('decrements outstanding and resets order status when a PRODUCTION_READY order is edited', async () => {
      const { proc, customer, user } = await buildScaffold('03A');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(5000);

      await withUser(user.id, user.email, async () => {
        await ordersService.updateBasicDetails(orderId, { quantity: 120 } as any);
      });

      const afterEdit = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(afterEdit!.statusCode).toBe('CONFIGURE');
      expect(afterEdit!.completedProcesses).toBe(0);

      const custAfterEdit = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custAfterEdit!.outstandingAmount)).toBe(0);
    });

    it('order can be set PRODUCTION_READY and finalized again after being reverted', async () => {
      const { proc, customer, user } = await buildScaffold('03B');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      await withUser(user.id, user.email, async () => {
        await ordersService.updateBasicDetails(orderId, { quantity: 120 } as any);
      });

      await ordersService.setProductionReady(orderId);
      const snapshot = await snapshotService.finalizeOrder(orderId, {}, BillingSnapshotIntent.FINAL);

      expect(snapshot.version).toBe(1);

      const final = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(final!.statusCode).toBe('BILLED');
    });
  });

  // ── E2E-04: Order soft-delete ─────────────────────────────────────────────────

  describe('E2E-04 — order soft-delete', () => {
    it('sets deletedAt on a CONFIGURE order without touching customer outstanding', async () => {
      const { proc, customer, user } = await buildScaffold('04A');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await ordersService.delete(orderId);

      const deleted = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(deleted!.deletedAt).not.toBeNull();

      const cust = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(cust!.outstandingAmount)).toBe(0);
    });

    it('decrements customer outstanding when a PRODUCTION_READY order is soft-deleted', async () => {
      const { proc, customer, user } = await buildScaffold('04B');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(5000);

      await ordersService.delete(orderId);

      const deleted = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(deleted!.deletedAt).not.toBeNull();

      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(0);
    });

    it('throws NotFoundException when deleting a non-existent order', async () => {
      await expect(
        ordersService.delete('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(NotFoundException);
    });

    it('soft-deleted order is not returned by getById', async () => {
      const { proc, customer, user } = await buildScaffold('04C');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id);

      await ordersService.delete(orderId);

      await expect(ordersService.getById(orderId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── E2E-05: addProcessToOrder ──────────────────────────────────────────────────

  describe('E2E-05 — addProcessToOrder', () => {
    async function buildSecondProcess(suffix: string) {
      const { wf: configWf } = await seedSimpleWorkflow(
        testPrisma,
        `E2E_CFG_${suffix}`,
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf } = await seedSimpleWorkflow(
        testPrisma,
        `E2E_LC_${suffix}`,
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );
      const template = await seedRunTemplate(testPrisma, {
        name: `E2E Template ${suffix}`,
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf.id,
        lifecycleWorkflowTypeId: lifecycleWf.id,
      });
      return seedProcess(testPrisma, template.id, `E2E Process ${suffix}`);
    }

    it('adds a second process to a CONFIGURE order and increments totalProcesses', async () => {
      const { proc: proc1, customer, user } = await buildScaffold('05A');
      const proc2 = await buildSecondProcess('05A2');
      const orderId = await createOrder(user.id, user.email, customer.id, proc1.id, 50);

      const before = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(before!.totalProcesses).toBe(1);

      await withUser(user.id, user.email, async () => {
        await ordersService.addProcessToOrder(orderId, { processId: proc2.id, count: 1 });
      });

      const after = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(after!.totalProcesses).toBe(2);

      const processes = await testPrisma.orderProcess.findMany({ where: { orderId } });
      expect(processes.length).toBe(2);

      const newRuns = await testPrisma.processRun.findMany({
        where: { orderProcess: { orderId, processId: proc2.id } },
      });
      expect(newRuns.length).toBe(1);
      expect(newRuns[0].statusCode).toBe('CONFIGURE');
    });

    it('reverts PRODUCTION_READY order to CONFIGURE and decrements outstanding', async () => {
      const { proc: proc1, customer, user } = await buildScaffold('05C');
      const proc2 = await buildSecondProcess('05D');
      const orderId = await createOrder(user.id, user.email, customer.id, proc1.id);

      await setRunFields(orderId, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(5000);

      await withUser(user.id, user.email, async () => {
        await ordersService.addProcessToOrder(orderId, { processId: proc2.id, count: 1 });
      });

      const after = await testPrisma.order.findUnique({ where: { id: orderId } });
      expect(after!.statusCode).toBe('CONFIGURE');
      expect(after!.completedProcesses).toBe(0);

      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(0);
    });

    it('throws BadRequestException when adding a process that already exists on the order', async () => {
      const { proc, customer, user } = await buildScaffold('05E');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id, 50);

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.addProcessToOrder(orderId, { processId: proc.id, count: 1 }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    it('throws BadRequestException when count is zero', async () => {
      const { proc, customer, user } = await buildScaffold('05F');
      const proc2 = await buildSecondProcess('05F2');
      const orderId = await createOrder(user.id, user.email, customer.id, proc.id, 50);

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.addProcessToOrder(orderId, { processId: proc2.id, count: 0 }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  // ── E2E-06: Reorder (clone) ───────────────────────────────────────────────────

  describe('E2E-06 — reorder (clone an existing order)', () => {
    it('creates a new CONFIGURE order with same structure, estimatedAmount reset to 0', async () => {
      const { proc, customer, user } = await buildScaffold('06A');
      const sourceOrderId = await createOrder(user.id, user.email, customer.id, proc.id, 50);

      const sourceRun = await setRunFields(sourceOrderId, {
        'Estimated Amount': 5000,
        new_rate: 50,
      });
      await ordersService.setProductionReady(sourceOrderId);

      let newOrderId!: string;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.reorder(sourceOrderId);
        newOrderId = r!.id;
      });

      expect(newOrderId).toBeDefined();
      expect(newOrderId).not.toBe(sourceOrderId);

      const newOrder = await testPrisma.order.findUnique({ where: { id: newOrderId } });
      expect(newOrder!.statusCode).toBe('CONFIGURE');
      expect(Number(newOrder!.estimatedAmount)).toBe(0);
      expect(newOrder!.customerId).toBe(customer.id);
      expect(newOrder!.quantity).toBe(50);

      const newProcesses = await testPrisma.orderProcess.findMany({ where: { orderId: newOrderId } });
      expect(newProcesses.length).toBe(1);

      const newRuns = await testPrisma.processRun.findMany({
        where: { orderProcess: { orderId: newOrderId } },
      });
      expect(newRuns.length).toBe(1);
      expect(newRuns[0].statusCode).toBe('CONFIGURE');
      expect(newRuns[0].id).not.toBe(sourceRun.id);
    });

    it('throws NotFoundException when reordering a non-existent source order', async () => {
      const { user } = await buildScaffold('06B');

      await withUser(user.id, user.email, async () => {
        await expect(
          ordersService.reorder('00000000-0000-0000-0000-000000000099'),
        ).rejects.toThrow(NotFoundException);
      });
    });

    it('new order inherits the isTest flag and gets a matching code prefix', async () => {
      const { proc, customer, user } = await buildScaffold('06C');
      const sourceOrderId = await createOrder(user.id, user.email, customer.id, proc.id, 30);

      let newOrderId!: string;
      await withUser(user.id, user.email, async () => {
        const r = await ordersService.reorder(sourceOrderId);
        newOrderId = r!.id;
      });

      const newOrder = await testPrisma.order.findUnique({ where: { id: newOrderId } });
      expect(newOrder!.isTest).toBe(true);
      expect(newOrder!.code).toMatch(/^TESTORD/);
    });
  });

  // ── E2E-07: Group snapshot with per-order rate overrides ──────────────────────

  describe('E2E-07 — group snapshot with per-order rate overrides', () => {
    it('overridden order is re-billed at the new rate; non-overridden order keeps its snapshot rate', async () => {
      const { proc: proc1, customer, user } = await buildScaffold('07A');

      const { wf: configWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_CFG_07B',
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_LC_07B',
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );
      const template2 = await seedRunTemplate(testPrisma, {
        name: 'E2E Template 07B',
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf2.id,
        lifecycleWorkflowTypeId: lifecycleWf2.id,
      });
      const proc2 = await seedProcess(testPrisma, template2.id, 'E2E Process 07B');

      let orderId1!: string;
      let orderId2!: string;
      await withUser(user.id, user.email, async () => {
        const r1 = await ordersService.create({
          customerId: customer.id,
          quantity: 100,
          processes: [{ processId: proc1.id, count: 1 }],
          isTest: true,
        } as any);
        orderId1 = r1!.id;

        const r2 = await ordersService.create({
          customerId: customer.id,
          quantity: 100,
          processes: [{ processId: proc2.id, count: 1 }],
          isTest: true,
        } as any);
        orderId2 = r2!.id;
      });

      // order1: new_rate=30 → 100*30=3000; order2: new_rate=20 → 100*20=2000
      const run1 = await setRunFields(orderId1, { 'Estimated Amount': 3000, new_rate: 30 });
      await setRunFields(orderId2, { 'Estimated Amount': 2000, new_rate: 20 });

      await ordersService.setProductionReady(orderId1);
      await ordersService.setProductionReady(orderId2);

      await snapshotService.finalizeOrder(orderId1, {}, BillingSnapshotIntent.FINAL);
      await snapshotService.finalizeOrder(orderId2, {}, BillingSnapshotIntent.FINAL);

      const groupContext = await testPrisma.billingContext.create({
        data: {
          type: 'GROUP',
          name: 'TESTR_OVR',
          isTest: true,
          orders: {
            createMany: { data: [{ orderId: orderId1 }, { orderId: orderId2 }] },
          },
        },
      });

      // Override order1's new_rate from 30 to 50 → 100*50=5000; order2 unchanged → 2000
      const overrideInputs = {
        [orderId1]: { [run1.id]: { new_rate: 50 } },
      };

      const groupSnapshot = await snapshotService.createGroupSnapshotTx(
        groupContext.id,
        overrideInputs,
      );

      // Total = 5000 (overridden order1) + 2000 (unchanged order2) = 7000
      expect(Number(groupSnapshot.result)).toBe(7000);
      expect(groupSnapshot.version).toBe(1);
    });
  });

  // ── E2E-08: deleteBulk outstanding adjustments ───────────────────────────────

  describe('E2E-08 — deleteBulk adjusts outstanding only for PRODUCTION_READY+ orders', () => {
    it('soft-deletes CONFIGURE orders without touching customer outstanding', async () => {
      const { proc, customer, user } = await buildScaffold('08A');
      const orderId1 = await createOrder(user.id, user.email, customer.id, proc.id, 50);
      const orderId2 = await createOrder(user.id, user.email, customer.id, proc.id, 50);

      await ordersService.deleteBulk([orderId1, orderId2]);

      const o1 = await testPrisma.order.findUnique({ where: { id: orderId1 } });
      const o2 = await testPrisma.order.findUnique({ where: { id: orderId2 } });
      expect(o1!.deletedAt).not.toBeNull();
      expect(o2!.deletedAt).not.toBeNull();

      const cust = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(cust!.outstandingAmount)).toBe(0);
    });

    it('decrements outstanding only for PRODUCTION_READY orders in a mixed bulk delete', async () => {
      const { proc: proc1, customer, user } = await buildScaffold('08B');

      const { wf: configWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_CFG_08C',
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf2 } = await seedSimpleWorkflow(
        testPrisma,
        'E2E_LC_08C',
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );
      const template2 = await seedRunTemplate(testPrisma, {
        name: 'E2E Template 08C',
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf2.id,
        lifecycleWorkflowTypeId: lifecycleWf2.id,
      });
      const proc2 = await seedProcess(testPrisma, template2.id, 'E2E Process 08C');

      const orderId1 = await createOrder(user.id, user.email, customer.id, proc1.id);
      const orderId2 = await createOrder(user.id, user.email, customer.id, proc2.id);

      await setRunFields(orderId1, { 'Estimated Amount': 5000, new_rate: 50 });
      await ordersService.setProductionReady(orderId1);

      const custMid = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custMid!.outstandingAmount)).toBe(5000);

      await ordersService.deleteBulk([orderId1, orderId2]);

      const o1 = await testPrisma.order.findUnique({ where: { id: orderId1 } });
      const o2 = await testPrisma.order.findUnique({ where: { id: orderId2 } });
      expect(o1!.deletedAt).not.toBeNull();
      expect(o2!.deletedAt).not.toBeNull();

      // PRODUCTION_READY order's 5000 is subtracted; CONFIGURE order adds nothing
      const custFinal = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(Number(custFinal!.outstandingAmount)).toBe(0);
    });

    it('returns count=0 and does not throw for an empty id list', async () => {
      const result = await ordersService.deleteBulk([]);
      expect(result).toEqual({ success: true, count: 0 });
    });
  });
});
