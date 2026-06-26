/**
 * Integration tests for RunsService (create, update, list, get).
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
} from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { FormulaCompiler } from '../billing/formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../billing/formula/math-only.formula.engine';
import { BillingCalculatorService } from '../billing/services/billing-calculator.service';
import { RunFieldsValidator } from './run-fields.validator';
import { RunsService } from './runs.service';

async function buildScaffold(testPrisma: ReturnType<typeof getTestPrisma>) {
  const { wf: configWf } = await seedSimpleWorkflow(
    testPrisma,
    'RS_CFG_WF',
    ['CONFIGURE', 'COMPLETE'],
    [['CONFIGURE', 'COMPLETE']],
  );
  const { wf: lifecycleWf } = await seedSimpleWorkflow(
    testPrisma,
    'RS_LC_WF',
    ['DESIGN', 'COMPLETE'],
    [['DESIGN', 'COMPLETE']],
  );

  const template = await seedRunTemplate(testPrisma, {
    name: 'RS Template',
    billingFormula: 'quantity * new_rate',
    configWorkflowTypeId: configWf.id,
    lifecycleWorkflowTypeId: lifecycleWf.id,
  });

  const proc = await seedProcess(testPrisma, template.id, 'Screen Printing');
  const customer = await seedCustomer(testPrisma, { code: 'RS_CUST', name: 'RS Customer' });
  const user = await seedUser(testPrisma, { email: 'rs@test.com', name: 'RS User' });

  const order = await seedOrder(testPrisma, {
    customerId: customer.id,
    createdById: user.id,
    quantity: 100,
    isTest: true,
  });

  const orderProcess = await testPrisma.orderProcess.create({
    data: {
      orderId: order.id,
      processId: proc.id,
      statusCode: 'CONFIGURE',
    },
  });

  return { configWf, lifecycleWf, template, proc, customer, user, order, orderProcess };
}

describe('RunsService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(prismaService, compiler, mathEngine);
  const validator = new RunFieldsValidator();
  const service = new RunsService(prismaService, validator, calculator);

  let scaffold: Awaited<ReturnType<typeof buildScaffold>>;

  beforeAll(async () => {
    await cleanDatabase(testPrisma);
    scaffold = await buildScaffold(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── list ─────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns empty array when no runs exist', async () => {
      const runs = await service.list(scaffold.order.id, scaffold.orderProcess.id);
      expect(runs).toEqual([]);
    });

    it('throws BadRequestException for invalid order/process combo', async () => {
      await expect(
        service.list('00000000-0000-0000-0000-000000000099', scaffold.orderProcess.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── create & get ─────────────────────────────────────────────────────────

  describe('create and get', () => {
    let runId: string;

    it('creates a run and recomputes order estimated amount', async () => {
      const run = await service.create(
        prismaService,
        {
          orderProcessId: scaffold.orderProcess.id,
          runTemplateId: scaffold.template.id,
          runNumber: 1,
          displayName: 'Screen Print Run 1',
          configWorkflowTypeId: scaffold.configWf.id,
          lifecycleWorkflowTypeId: scaffold.lifecycleWf.id,
          statusCode: 'CONFIGURE',
          lifeCycleStatusCode: 'DESIGN',
          fields: { 'Estimated Amount': 5000, new_rate: 50 },
        },
        scaffold.order.id,
      );

      runId = run.id;
      expect(run.runNumber).toBe(1);
      expect(run.displayName).toBe('Screen Print Run 1');

      // Estimated amount on the order should be updated
      const order = await testPrisma.order.findUnique({ where: { id: scaffold.order.id } });
      expect(Number(order!.estimatedAmount)).toBe(5000);
    });

    it('get returns the correct run', async () => {
      const run = await service.get(scaffold.order.id, scaffold.orderProcess.id, runId);
      expect(run.id).toBe(runId);
    });

    it('get throws BadRequestException for wrong order/process/run combo', async () => {
      await expect(
        service.get(scaffold.order.id, scaffold.orderProcess.id, '00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(BadRequestException);
    });

    it('list returns the created run', async () => {
      const runs = await service.list(scaffold.order.id, scaffold.orderProcess.id);
      expect(runs.length).toBe(1);
      expect(runs[0].id).toBe(runId);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    let runId: string;

    beforeAll(async () => {
      const run = await testPrisma.processRun.create({
        data: {
          orderProcessId: scaffold.orderProcess.id,
          runTemplateId: scaffold.template.id,
          runNumber: 2,
          displayName: 'Update Test Run',
          configWorkflowTypeId: scaffold.configWf.id,
          lifecycleWorkflowTypeId: scaffold.lifecycleWf.id,
          statusCode: 'CONFIGURE',
          lifeCycleStatusCode: 'DESIGN',
          fields: { 'Estimated Amount': 3000, new_rate: 30 },
        },
      });
      runId = run.id;
    });

    it('updates run fields and recomputes estimated amount', async () => {
      await service.update(
        prismaService,
        runId,
        { fields: { 'Estimated Amount': 7000, new_rate: 70 } },
        scaffold.order.id,
      );

      const order = await testPrisma.order.findUnique({ where: { id: scaffold.order.id } });
      // Should sum both runs: run1(5000) + run2(7000) = 12000
      expect(Number(order!.estimatedAmount)).toBe(12000);
    });

    it('updates run comments', async () => {
      const updated = await service.update(
        prismaService,
        runId,
        { comments: 'Rush order — priority' },
        scaffold.order.id,
      );
      expect(updated.comments).toBe('Rush order — priority');
    });
  });
});
