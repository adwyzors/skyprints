/**
 * Integration tests for OrdersService.
 * Needs a PostgreSQL test DB (DATABASE_URL from .env.test).
 *   npm run db:test:push && npm run test:integration
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
} from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextStore } from '../common/context/request-context.store';
import { FormulaCompiler } from '../billing/formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../billing/formula/math-only.formula.engine';
import { BillingCalculatorService } from '../billing/services/billing-calculator.service';
import { OrdersService } from './orders.service';

// Minimal CloudflareService stub — we don't test image operations here
const cloudflareStub: any = {
  isValidImageUrl: () => true,
  deleteImage: async () => {},
};

const notificationsStub: any = { createNotification: async () => {} };

describe('OrdersService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(prismaService, compiler, mathEngine);
  const service = new OrdersService(prismaService, cloudflareStub, calculator, notificationsStub);

  beforeAll(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── validateCreditLimit ──────────────────────────────────────────────────

  describe('validateCreditLimit', () => {
    let customerId: string;
    let userId: string;

    beforeEach(async () => {
      await cleanDatabase(testPrisma);
      const user = await seedUser(testPrisma);
      userId = user.id;
    });

    it('does NOT throw when creditLimit is 0 (no limit configured)', async () => {
      const customer = await seedCustomer(testPrisma, { creditLimit: 0 });
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id),
        ),
      ).resolves.toBeUndefined();
    });

    it('does NOT throw when exposure is below the credit limit', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_OK',
          name: 'Good Customer',
          creditLimit: 10000,
          outstandingAmount: 2000,
        },
      });
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id, 5000),
        ),
      ).resolves.toBeUndefined();
    });

    it('throws when exposure equals the credit limit', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_AT',
          name: 'At Limit',
          creditLimit: 5000,
          outstandingAmount: 5000,
        },
      });
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id),
        ),
      ).rejects.toThrow('Credit limit reached');
    });

    it('throws when outstanding amount alone meets the credit limit', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_OVER',
          name: 'Over Limit',
          creditLimit: 3000,
          outstandingAmount: 3500,
        },
      });
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id),
        ),
      ).rejects.toThrow('Credit limit reached');
    });

    it('throws BadRequestException when customer does not exist', async () => {
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, 'non-existent-id'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes CONFIGURE-status order estimatedAmount in exposure', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_CONF',
          name: 'Config Order Customer',
          creditLimit: 5000,
          outstandingAmount: 0,
        },
      });
      // An active (CONFIGURE) order with estimatedAmount = 4000
      await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: userId,
        statusCode: 'CONFIGURE',
        estimatedAmount: 4000,
        isTest: false,
      });

      // additionalAmount = 1001 → exposure = 0 + 4000 + 1001 = 5001 ≥ 5000 → throw
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id, 1001),
        ),
      ).rejects.toThrow('Credit limit reached');
    });

    it('excludes PRODUCTION_READY orders from exposure (only CONFIGURE counted)', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_PROD',
          name: 'Prod Order Customer',
          creditLimit: 5000,
          outstandingAmount: 0,
        },
      });
      // A PRODUCTION_READY order should NOT be counted in estimatedAmount exposure
      await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: userId,
        statusCode: 'PRODUCTION_READY',
        estimatedAmount: 4999,
        isTest: false,
      });

      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id, 1),
        ),
      ).resolves.toBeUndefined();
    });

    it('excludes an order when excludeOrderId is provided', async () => {
      const customer = await testPrisma.customer.create({
        data: {
          code: 'CUST_EXCL',
          name: 'Exclude Order Customer',
          creditLimit: 5000,
          outstandingAmount: 0,
        },
      });
      const order = await seedOrder(testPrisma, {
        customerId: customer.id,
        createdById: userId,
        statusCode: 'CONFIGURE',
        estimatedAmount: 4999,
        isTest: false,
      });

      // Without exclusion, 4999 + 1 additionalAmount = 5000 → throws
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id, 1, undefined),
        ),
      ).rejects.toThrow('Credit limit reached');

      // With exclusion of that order → exposure = 0 + 1 = 1 → passes
      await expect(
        testPrisma.$transaction((tx) =>
          service.validateCreditLimit(tx, customer.id, 1, order.id),
        ),
      ).resolves.toBeUndefined();
    });
  });

  // ── create order (smoke test) ────────────────────────────────────────────

  describe('create', () => {
    let customerId: string;
    let userId: string;
    let processId: string;

    beforeEach(async () => {
      await cleanDatabase(testPrisma);

      const { wf: configWf } = await seedSimpleWorkflow(
        testPrisma,
        'ORD_CFG_WF',
        ['CONFIGURE', 'COMPLETE'],
        [['CONFIGURE', 'COMPLETE']],
      );
      const { wf: lifecycleWf } = await seedSimpleWorkflow(
        testPrisma,
        'ORD_LC_WF',
        ['DESIGN', 'COMPLETE'],
        [['DESIGN', 'COMPLETE']],
      );

      const template = await seedRunTemplate(testPrisma, {
        name: 'Create Test Template',
        billingFormula: 'quantity * new_rate',
        configWorkflowTypeId: configWf.id,
        lifecycleWorkflowTypeId: lifecycleWf.id,
      });

      const proc = await seedProcess(testPrisma, template.id, 'Screen Printing');
      processId = proc.id;

      const customer = await seedCustomer(testPrisma);
      customerId = customer.id;

      const user = await seedUser(testPrisma);
      userId = user.id;
    });

    it('creates an order with correct status and code format', async () => {
      const dto: any = {
        customerId,
        quantity: 50,
        processes: [{ processId, count: 1 }],
        isTest: true,
      };

      let createdOrderId: string | undefined;

      await RequestContextStore.run(
        {
          correlationId: 'test-cid',
          user: { id: userId, email: 'test@test.com', permissions: [], roles: ['ADMIN'] },
        },
        async () => {
          const result = await service.create(dto);
          createdOrderId = result?.id;
        },
      );

      expect(createdOrderId).toBeDefined();

      const order = await testPrisma.order.findUnique({ where: { id: createdOrderId } });
      expect(order).not.toBeNull();
      expect(order!.statusCode).toBe('CONFIGURE');
      expect(order!.code).toMatch(/^TESTORD\d+\/\d{2}-\d{2}$/);
      expect(order!.quantity).toBe(50);
      expect(order!.customerId).toBe(customerId);
    });

    it('creates OrderProcess and ProcessRun rows for each process', async () => {
      const dto: any = {
        customerId,
        quantity: 20,
        processes: [{ processId, count: 1 }],
        isTest: true,
      };

      let orderId: string | undefined;

      await RequestContextStore.run(
        {
          correlationId: 'test-cid-2',
          user: { id: userId, email: 'test@test.com', permissions: [], roles: ['ADMIN'] },
        },
        async () => {
          const result = await service.create(dto);
          orderId = result?.id;
        },
      );

      const op = await testPrisma.orderProcess.findFirst({ where: { orderId } });
      expect(op).not.toBeNull();
      expect(op!.processId).toBe(processId);

      const runs = await testPrisma.processRun.findMany({ where: { orderProcessId: op!.id } });
      expect(runs.length).toBe(1);
    });

    it('rejects creation when user context is missing', async () => {
      const dto: any = {
        customerId,
        quantity: 10,
        processes: [{ processId, count: 1 }],
        isTest: true,
      };

      // No RequestContextStore.run() wrapper → store returns undefined
      await expect(service.create(dto)).rejects.toThrow('User context missing');
    });

    it('throws when a process is disabled', async () => {
      await testPrisma.process.update({ where: { id: processId }, data: { isEnabled: false } });

      const dto: any = {
        customerId,
        quantity: 10,
        processes: [{ processId, count: 1 }],
        isTest: true,
      };

      await RequestContextStore.run(
        {
          correlationId: 'test-cid-3',
          user: { id: userId, email: 'test@test.com', permissions: [], roles: ['ADMIN'] },
        },
        async () => {
          await expect(service.create(dto)).rejects.toThrow(
            'One or more processes are disabled or invalid',
          );
        },
      );
    });
  });
});
