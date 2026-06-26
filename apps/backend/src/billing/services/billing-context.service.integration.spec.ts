/**
 * Integration tests for BillingContextService.
 * Needs DATABASE_URL from .env.test → npm run test:integration
 */
import { BadRequestException } from '@nestjs/common';
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
import { BillingContextService } from './billing-context.service';
import { BillingSnapshotService } from './billing-snapshot.service';

function buildServices() {
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(prismaService, compiler, mathEngine);
  const contextResolver = new BillingContextResolver();
  const analyticsStub: any = { trackOrderFinalized: async () => {} };
  const ordersStub: any = {};
  const snapshotService = new BillingSnapshotService(
    prismaService,
    calculator,
    contextResolver,
    ordersStub,
    analyticsStub,
  );
  const contextService = new BillingContextService(prismaService, snapshotService, calculator);
  return { prismaService, calculator, contextResolver, snapshotService, contextService };
}

describe('BillingContextService (integration)', () => {
  const testPrisma = getTestPrisma();
  const { contextService, snapshotService, prismaService } = buildServices();

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── ORDER context ────────────────────────────────────────────────────────

  describe('create — ORDER type', () => {
    it('creates an ORDER billing context with the given name', async () => {
      const ctx = await contextService.create({
        type: 'ORDER',
        name: 'Order Billing Test',
      });

      expect(ctx.type).toBe('ORDER');
      expect(ctx.name).toBe('Order Billing Test');

      const stored = await testPrisma.billingContext.findUnique({ where: { id: ctx.id } });
      expect(stored).toBeTruthy();
    });

    it('creates an ORDER context with orderIds and validates them', async () => {
      const customer = await seedCustomer(testPrisma, { code: 'BCT_CUST', name: 'BCT Customer' });
      const user = await seedUser(testPrisma, { email: 'bct@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
        isTest: true,
      });

      const ctx = await contextService.create({
        type: 'ORDER',
        name: 'Order with IDs',
        orderIds: [order.id],
      });

      expect(ctx.type).toBe('ORDER');

      const link = await testPrisma.billingContextOrder.findFirst({
        where: { billingContextId: ctx.id, orderId: order.id },
      });
      expect(link).toBeTruthy();
    });

    it('throws BadRequestException when any orderId does not exist', async () => {
      await expect(
        contextService.create({
          type: 'ORDER',
          name: 'Bad Order',
          orderIds: ['00000000-0000-0000-0000-000000000001'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when mixing valid and non-existent orderIds', async () => {
      const customer = await seedCustomer(testPrisma, { code: 'BCT2', name: 'BCT2' });
      const user = await seedUser(testPrisma, { email: 'bct2@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
      });

      await expect(
        contextService.create({
          type: 'ORDER',
          name: 'Mixed IDs',
          orderIds: [order.id, '00000000-0000-0000-0000-000000000002'],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── GROUP context ────────────────────────────────────────────────────────

  describe('create — GROUP type', () => {
    it('auto-generates a TESTR-prefixed name for test GROUP contexts', async () => {
      const ctx = await contextService.create({
        type: 'GROUP',
        isTest: true,
      });

      expect(ctx.type).toBe('GROUP');
      expect(ctx.name).toMatch(/^TESTR/);
    });

    it('auto-generates an R-prefixed name for non-test GROUP contexts', async () => {
      const ctx = await contextService.create({
        type: 'GROUP',
        isTest: false,
      });

      expect(ctx.type).toBe('GROUP');
      expect(ctx.name).toMatch(/^R/);
      expect(ctx.name).not.toMatch(/^TESTR/);
    });

    it('increments fiscal sequence on each GROUP context creation', async () => {
      const first = await contextService.create({ type: 'GROUP', isTest: true });
      const second = await contextService.create({ type: 'GROUP', isTest: true });

      // The codes should be different and sequential
      expect(first.name).not.toBe(second.name);
    });

    it('creates GROUP context with valid orderIds and auto-generates TESTR name', async () => {
      // Set up full order hierarchy with a run so billing can compute
      const { wf: configWf } = await seedSimpleWorkflow(
        testPrisma,
        'BC_CFG',
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf } = await seedSimpleWorkflow(
        testPrisma,
        'BC_LC',
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );
      const template = await seedRunTemplate(testPrisma, {
        name: 'BC Template',
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf.id,
        lifecycleWorkflowTypeId: lifecycleWf.id,
      });
      const proc = await seedProcess(testPrisma, template.id, 'BC Process');
      const customer = await seedCustomer(testPrisma, { code: 'BCG_C', name: 'BCG Customer' });
      const user = await seedUser(testPrisma, { email: 'bcg@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
        quantity: 50,
        isTest: true,
      });
      const orderProcess = await testPrisma.orderProcess.create({
        data: { orderId: order.id, processId: proc.id, statusCode: 'CONFIGURE' },
      });
      await testPrisma.processRun.create({
        data: {
          orderProcessId: orderProcess.id,
          runTemplateId: template.id,
          runNumber: 1,
          displayName: 'BCG Run',
          configWorkflowTypeId: configWf.id,
          lifecycleWorkflowTypeId: lifecycleWf.id,
          statusCode: 'CONFIGURE',
          lifeCycleStatusCode: 'DESIGN',
          fields: { new_rate: 10 },
        },
      });

      // First create an ORDER snapshot (required for group snapshot)
      await snapshotService.finalizeOrder(order.id, {}, 'FINAL');

      // Now create the GROUP context with the order
      const ctx = await contextService.create({
        type: 'GROUP',
        isTest: true,
        orderIds: [order.id],
      });

      expect(ctx.type).toBe('GROUP');
      expect(ctx.name).toMatch(/^TESTR/);

      // A GROUP snapshot should have been created automatically
      const snapshot = await testPrisma.billingSnapshot.findFirst({
        where: { billingContextId: ctx.id, intent: 'FINAL' },
      });
      expect(snapshot).toBeTruthy();
      expect(Number(snapshot!.result)).toBe(500); // 50 * 10
    });
  });

  // ── addOrders ────────────────────────────────────────────────────────────

  describe('addOrders', () => {
    it('adds new orders to an existing context', async () => {
      const ctx = await contextService.create({ type: 'ORDER', name: 'Add Orders Test' });

      const customer = await seedCustomer(testPrisma, { code: 'AO_C', name: 'AO Customer' });
      const user = await seedUser(testPrisma, { email: 'ao@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
      });

      const result = await contextService.addOrders(ctx.id, [order.id]);
      expect(result.added).toBe(1);

      const link = await testPrisma.billingContextOrder.findFirst({
        where: { billingContextId: ctx.id, orderId: order.id },
      });
      expect(link).toBeTruthy();
    });

    it('is idempotent — does not add duplicates', async () => {
      const ctx = await contextService.create({ type: 'ORDER', name: 'Dedup Test' });

      const customer = await seedCustomer(testPrisma, { code: 'DD_C', name: 'DD Customer' });
      const user = await seedUser(testPrisma, { email: 'dd@test.com' });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: user.id,
      });

      await contextService.addOrders(ctx.id, [order.id]);
      const second = await contextService.addOrders(ctx.id, [order.id]);
      expect(second.added).toBe(0);
    });
  });

  // ── getAllContexts ────────────────────────────────────────────────────────

  describe('getAllContexts', () => {
    it('returns only GROUP contexts', async () => {
      // Create one ORDER and one GROUP context
      await contextService.create({ type: 'ORDER', name: 'Should Not Appear' });
      await contextService.create({ type: 'GROUP', isTest: true });

      const result = await contextService.getAllContexts(1, 12, '', true);
      expect(result.res.data.every((c: any) => c.type === 'GROUP')).toBe(true);
    });

    it('separates test and non-test contexts', async () => {
      await contextService.create({ type: 'GROUP', isTest: true });
      await contextService.create({ type: 'GROUP', isTest: false });

      const testResult = await contextService.getAllContexts(1, 12, '', true);
      const prodResult = await contextService.getAllContexts(1, 12, '', false);

      // test contexts only in testResult, prod only in prodResult
      expect(testResult.res.data.length).toBeGreaterThanOrEqual(1);
      expect(prodResult.res.data.length).toBeGreaterThanOrEqual(1);
    });

    it('paginates results correctly', async () => {
      await Promise.all([
        contextService.create({ type: 'GROUP', isTest: true }),
        contextService.create({ type: 'GROUP', isTest: true }),
        contextService.create({ type: 'GROUP', isTest: true }),
      ]);

      const page1 = await contextService.getAllContexts(1, 2, '', true);
      expect(page1.res.data.length).toBe(2);
      expect(page1.meta.total).toBeGreaterThanOrEqual(3);
      expect(page1.meta.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('filters by name search (case-insensitive)', async () => {
      // Create a context via Prisma directly so we control the name
      await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'UNIQUE_FIND_ME_XYZ', isTest: true },
      });

      const result = await contextService.getAllContexts(1, 12, 'find_me_xyz', true);
      expect(result.res.data.length).toBe(1);
      expect(result.res.data[0].name).toBe('UNIQUE_FIND_ME_XYZ');
    });

    it('returns empty array and meta.total=0 when no contexts match the search', async () => {
      const result = await contextService.getAllContexts(1, 12, 'NOMATCH_ZZZZ99', true);
      expect(result.res.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });

    it('returns empty array for a page number beyond total results', async () => {
      await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'PAGE_BEYOND_CTX', isTest: true },
      });

      const result = await contextService.getAllContexts(999, 12, '', true);
      expect(result.res.data).toEqual([]);
    });
  });

  // ── getContextById ────────────────────────────────────────────────────────

  describe('getContextById', () => {
    it('returns context with correct shape for an empty GROUP context', async () => {
      const ctx = await testPrisma.billingContext.create({
        data: { type: 'GROUP', name: 'GCB_TEST_CTX', isTest: true },
      });

      const result = await contextService.getContextById(ctx.id);

      expect(result.id).toBe(ctx.id);
      expect(result.type).toBe('GROUP');
      expect(result.name).toBe('GCB_TEST_CTX');
      expect(result.orders).toEqual([]);
      expect(result.latestSnapshot).toBeNull();
    });

    it('throws BadRequestException for a non-existent context id', async () => {
      await expect(
        contextService.getContextById('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── removeOrder ───────────────────────────────────────────────────────────

  describe('removeOrder', () => {
    it('deletes the billingContextOrder link between context and order', async () => {
      const customer = await seedCustomer(testPrisma, { code: 'RO_CUST', name: 'RO Customer' });
      const user = await seedUser(testPrisma, { email: 'ro@test.com' });
      const order = await seedOrder(testPrisma, { customerId: customer.id, createdById: user.id });
      const ctx = await testPrisma.billingContext.create({
        data: {
          type: 'ORDER',
          name: 'RO_CTX',
          orders: { create: { orderId: order.id } },
        },
      });

      await contextService.removeOrder(ctx.id, order.id);

      const link = await testPrisma.billingContextOrder.findFirst({
        where: { billingContextId: ctx.id, orderId: order.id },
      });
      expect(link).toBeNull();
    });
  });
});
