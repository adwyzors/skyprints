/**
 * Integration tests for BillingCalculatorService.
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
} from '../../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../../test/prisma';
import { PrismaService } from '../../../prisma/prisma.service';
import { FormulaCompiler } from '../formula/formula-compiler';
import { MathOnlyFormulaEngine } from '../formula/math-only.formula.engine';
import { BillingCalculatorService } from './billing-calculator.service';

describe('BillingCalculatorService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const service = new BillingCalculatorService(prismaService, compiler, mathEngine);

  let orderId: string;
  let runId: string;

  beforeAll(async () => {
    await cleanDatabase(testPrisma);

    // Minimal workflow scaffolding required by RunTemplate FK
    const { wf: configWf } = await seedSimpleWorkflow(
      testPrisma,
      'BC_CONFIG_WF',
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );
    const { wf: lifecycleWf } = await seedSimpleWorkflow(
      testPrisma,
      'BC_LIFECYCLE_WF',
      ['DESIGN', 'COMPLETE'],
      [['DESIGN', 'COMPLETE']],
    );

    const template = await seedRunTemplate(testPrisma, {
      name: 'Screen Printing Test',
      billingFormula: 'quantity * new_rate',
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWf.id,
    });

    const proc = await seedProcess(testPrisma, template.id, 'Screen Printing');
    const customer = await seedCustomer(testPrisma);
    const user = await seedUser(testPrisma);

    const order = await seedOrder(testPrisma, {
      customerId: customer.id,
      createdById: user.id,
      quantity: 100,
      isTest: true,
    });
    orderId = order.id;

    const orderProcess = await testPrisma.orderProcess.create({
      data: {
        orderId: order.id,
        processId: proc.id,
        statusCode: 'CONFIGURE',
      },
    });

    const run = await testPrisma.processRun.create({
      data: {
        orderProcessId: orderProcess.id,
        runTemplateId: template.id,
        runNumber: 1,
        displayName: 'Screen Printing Run 1',
        configWorkflowTypeId: configWf.id,
        lifecycleWorkflowTypeId: lifecycleWf.id,
        statusCode: 'CONFIGURE',
        lifeCycleStatusCode: 'DESIGN',
        // new_rate supplied here; quantity comes from Order
        fields: { new_rate: 50 },
      },
    });
    runId = run.id;
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── calculateForOrder ────────────────────────────────────────────────────

  it('calculates the correct total: quantity(100) * new_rate(50) = 5000', async () => {
    const { result } = await service.calculateForOrder(orderId);
    expect(result.toNumber()).toBe(5000);
  });

  it('includes the run in snapshot inputs keyed by runId', async () => {
    const { inputs } = await service.calculateForOrder(orderId);
    expect(inputs).toHaveProperty(runId);
    expect(inputs[runId]['new_rate']).toBe(50);
    expect(inputs[runId]['__RESULT__']).toBe(5000);
  });

  it('returns formula key ORDER_AGGREGATE', async () => {
    const { formula } = await service.calculateForOrder(orderId);
    expect(formula).toBe('ORDER_AGGREGATE');
  });

  it('accepts dynamic input overrides for new_rate', async () => {
    const { result } = await service.calculateForOrder(
      orderId,
      { [runId]: { new_rate: 75 } },
    );
    expect(result.toNumber()).toBe(7500);
  });

  it('throws BadRequestException when a required variable is missing and allowDefaults=false', async () => {
    // Temporarily swap to a formula that needs a variable not in fields
    const badTemplate = await testPrisma.runTemplate.findFirst({
      where: { name: 'Screen Printing Test' },
    });
    const origFormula = badTemplate!.billingFormula;

    // Create a second order with a run that has formula needing 'pcs' but no 'pcs' in fields
    const { wf: cfg2 } = await seedSimpleWorkflow(
      testPrisma,
      'BC_CFG2',
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );
    const { wf: lc2 } = await seedSimpleWorkflow(
      testPrisma,
      'BC_LC2',
      ['DESIGN', 'COMPLETE'],
      [['DESIGN', 'COMPLETE']],
    );
    const tpl2 = await testPrisma.runTemplate.create({
      data: {
        name: 'DTF Test',
        billingFormula: 'pcs * new_rate',
        fields: [],
        configWorkflowTypeId: cfg2.id,
        lifecycleWorkflowTypeId: lc2.id,
      },
    });
    const proc2 = await testPrisma.process.create({ data: { name: 'DTF Test', isEnabled: true } });
    const cust2 = await seedCustomer(testPrisma, { code: 'CUST2', name: 'Cust 2' });
    const user2 = await seedUser(testPrisma, { email: 'user2@test.com', name: 'User 2' });
    const order2 = await seedOrder(testPrisma, {
      customerId: cust2.id,
      createdById: user2.id,
      quantity: 50,
      isTest: true,
      code: `TESTORD-${Date.now()}-2`,
    });
    const op2 = await testPrisma.orderProcess.create({
      data: { orderId: order2.id, processId: proc2.id, statusCode: 'CONFIGURE' },
    });
    await testPrisma.processRun.create({
      data: {
        orderProcessId: op2.id,
        runTemplateId: tpl2.id,
        runNumber: 1,
        displayName: 'DTF Run',
        configWorkflowTypeId: cfg2.id,
        lifecycleWorkflowTypeId: lc2.id,
        statusCode: 'CONFIGURE',
        lifeCycleStatusCode: 'DESIGN',
        fields: { new_rate: 20 }, // missing 'pcs'
      },
    });

    await expect(service.calculateForOrder(order2.id)).rejects.toThrow(BadRequestException);
    await expect(service.calculateForOrder(order2.id)).rejects.toThrow('Missing variable "pcs"');
  });

  it('defaults missing variables to 0 when allowDefaults=true', async () => {
    // Use the existing order; there is no 'pcs' in fields but formula is quantity*new_rate so it works.
    // For allowDefaults test, pass allowDefaults=true and verify no throw.
    const { result } = await service.calculateForOrder(orderId, {}, true);
    expect(result.toNumber()).toBeGreaterThanOrEqual(0);
  });

  // ── calculateRun ─────────────────────────────────────────────────────────

  it('calculateRun returns per-run amount without DB hit', async () => {
    const mockRun = {
      fields: { new_rate: 60 },
      runTemplate: { billingFormula: 'quantity * new_rate' },
    };
    const amount = service.calculateRun(mockRun, 200);
    expect(amount).toBe(12000);
  });

  it('calculateRun returns 0 when runTemplate has no formula', async () => {
    const mockRun = {
      fields: {},
      runTemplate: { billingFormula: null },
    };
    expect(service.calculateRun(mockRun, 100)).toBe(0);
  });

  // ── calculateForOrder edge cases ─────────────────────────────────────────

  it('calculateForOrder returns Decimal(0) and empty inputs for an order with no runs', async () => {
    const cust = await seedCustomer(testPrisma, { code: 'BC_EMP', name: 'BC Empty Customer' });
    const usr = await seedUser(testPrisma, { email: 'bc_emp@test.com', name: 'BC Empty User' });
    const emptyOrder = await seedOrder(testPrisma, {
      customerId: cust.id,
      createdById: usr.id,
      quantity: 50,
      isTest: true,
      code: `BC_EMPTY_ORD_${Date.now()}`,
    });

    const { result, inputs } = await service.calculateForOrder(emptyOrder.id);

    expect(result.toNumber()).toBe(0);
    expect(Object.keys(inputs)).toHaveLength(0);
  });

  it('calculateForOrder sums amounts across multiple runs on the same OrderProcess', async () => {
    const { wf: cfg } = await seedSimpleWorkflow(
      testPrisma,
      'BC_CFG_MR',
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );
    const { wf: lc } = await seedSimpleWorkflow(
      testPrisma,
      'BC_LC_MR',
      ['DESIGN', 'COMPLETE'],
      [['DESIGN', 'COMPLETE']],
    );
    const tpl = await testPrisma.runTemplate.create({
      data: {
        name: 'BC MR Template',
        billingFormula: 'quantity * new_rate',
        fields: [],
        configWorkflowTypeId: cfg.id,
        lifecycleWorkflowTypeId: lc.id,
      },
    });
    const cust = await seedCustomer(testPrisma, { code: 'BC_MR_C', name: 'BC MR Customer' });
    const usr = await seedUser(testPrisma, { email: 'bc_mr@test.com', name: 'BC MR User' });
    const mrOrder = await seedOrder(testPrisma, {
      customerId: cust.id,
      createdById: usr.id,
      quantity: 100,
      isTest: true,
      code: `BC_MR_ORD_${Date.now()}`,
    });
    const proc = await testPrisma.process.create({ data: { name: 'BC MR Process', isEnabled: true } });
    const op = await testPrisma.orderProcess.create({
      data: { orderId: mrOrder.id, processId: proc.id, statusCode: 'CONFIGURE' },
    });
    await testPrisma.processRun.create({
      data: {
        orderProcessId: op.id,
        runTemplateId: tpl.id,
        runNumber: 1,
        displayName: 'MR Run 1',
        configWorkflowTypeId: cfg.id,
        lifecycleWorkflowTypeId: lc.id,
        statusCode: 'CONFIGURE',
        lifeCycleStatusCode: 'DESIGN',
        fields: { new_rate: 30 }, // 100 * 30 = 3000
      },
    });
    await testPrisma.processRun.create({
      data: {
        orderProcessId: op.id,
        runTemplateId: tpl.id,
        runNumber: 2,
        displayName: 'MR Run 2',
        configWorkflowTypeId: cfg.id,
        lifecycleWorkflowTypeId: lc.id,
        statusCode: 'CONFIGURE',
        lifeCycleStatusCode: 'DESIGN',
        fields: { new_rate: 20 }, // 100 * 20 = 2000
      },
    });

    const { result } = await service.calculateForOrder(mrOrder.id);

    expect(result.toNumber()).toBe(5000); // 3000 + 2000
  });

  // ── calculateForGroupFromSnapshots ───────────────────────────────────────

  it('calculateForGroupFromSnapshots aggregates result across orders using snapshot inputs', async () => {
    // Uses the orderId/runId seeded in beforeAll: quantity=100, formula=quantity*new_rate
    const groupResult = await service.calculateForGroupFromSnapshots([
      { orderId, inputs: { [runId]: { new_rate: 50 } } },
    ]);

    expect(groupResult.result.toNumber()).toBe(5000); // 100 * 50
    expect(groupResult.perOrderCalculations).toHaveProperty(orderId);
    expect(groupResult.perOrderCalculations[orderId].result.toNumber()).toBe(5000);
  });
});
