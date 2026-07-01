/**
 * Integration tests for ManagerQueueService — atomic claim race + full
 * queue -> claim -> complete lifecycle. Needs DATABASE_URL from .env.test
 * → npm run test:integration
 */
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
import { OrdersService } from '../orders/orders.service';
import { AdminProcessService } from '../processes/admin-process.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ManagerQueueService } from './manager-queue.service';

// Minimal CloudflareService stub — we don't test image operations here
const cloudflareStub: any = {
  isValidImageUrl: () => true,
  deleteImage: async () => {},
};

async function buildScaffold(testPrisma: ReturnType<typeof getTestPrisma>) {
  const { wf: configWf } = await seedSimpleWorkflow(
    testPrisma,
    'MQ_CFG_WF',
    ['CONFIGURE', 'COMPLETE'],
    [['CONFIGURE', 'COMPLETE']],
  );
  const { wf: lifecycleWf } = await seedSimpleWorkflow(
    testPrisma,
    'MQ_LC_WF',
    ['DESIGN', 'PRODUCTION', 'WAITING', 'COMPLETE'],
    [
      ['DESIGN', 'PRODUCTION'],
      ['PRODUCTION', 'WAITING'],
      ['WAITING', 'COMPLETE'],
    ],
  );

  const template = await seedRunTemplate(testPrisma, {
    name: 'MQ Template',
    billingFormula: 'quantity * new_rate',
    configWorkflowTypeId: configWf.id,
    lifecycleWorkflowTypeId: lifecycleWf.id,
  });

  const proc = await seedProcess(testPrisma, template.id, 'MQ Screen Printing');
  const customer = await seedCustomer(testPrisma, {
    code: 'MQ_CUST',
    name: 'MQ Customer',
  });
  const admin = await seedUser(testPrisma, {
    email: 'mq-admin@test.com',
    name: 'MQ Admin',
    role: 'ADMIN',
  });
  const managerA = await seedUser(testPrisma, {
    email: 'mq-mgr-a@test.com',
    name: 'MQ Manager A',
    role: 'MANAGER',
  });
  const managerB = await seedUser(testPrisma, {
    email: 'mq-mgr-b@test.com',
    name: 'MQ Manager B',
    role: 'MANAGER',
  });

  const order = await seedOrder(testPrisma, {
    customerId: customer.id,
    createdById: admin.id,
    quantity: 100,
    statusCode: 'IN_PRODUCTION',
    isTest: true,
  });

  const orderProcess = await testPrisma.orderProcess.create({
    data: {
      orderId: order.id,
      processId: proc.id,
      statusCode: 'IN_PROGRESS',
    },
  });

  const productionStatus = await testPrisma.workflowStatus.findFirstOrThrow({
    where: { workflowTypeId: lifecycleWf.id, code: 'PRODUCTION' },
  });

  const run = await testPrisma.processRun.create({
    data: {
      orderProcessId: orderProcess.id,
      runTemplateId: template.id,
      runNumber: 1,
      displayName: 'MQ Run 1',
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWf.id,
      statusCode: 'IN_PROGRESS',
      lifeCycleStatusCode: 'PRODUCTION',
      fields: { Quantity: 100 },
    },
  });

  return {
    lifecycleWf,
    proc,
    customer,
    admin,
    managerA,
    managerB,
    order,
    orderProcess,
    run,
    productionStatus,
  };
}

describe('ManagerQueueService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const compiler = new FormulaCompiler();
  const mathEngine = new MathOnlyFormulaEngine();
  const calculator = new BillingCalculatorService(
    prismaService,
    compiler,
    mathEngine,
  );
  const notificationsService = new NotificationsService(prismaService);
  const ordersService = new OrdersService(
    prismaService,
    cloudflareStub,
    calculator,
    notificationsService,
  );
  const adminProcessService = new AdminProcessService(
    prismaService,
    ordersService,
    cloudflareStub,
    calculator,
    notificationsService,
  );
  const service = new ManagerQueueService(prismaService, adminProcessService);

  let scaffold: Awaited<ReturnType<typeof buildScaffold>>;

  beforeAll(async () => {
    await cleanDatabase(testPrisma);
    scaffold = await buildScaffold(testPrisma);
    await testPrisma.managerStagePermission.createMany({
      data: [
        {
          managerId: scaffold.managerA.id,
          processId: scaffold.proc.id,
          lifecycleStageId: scaffold.productionStatus.id,
        },
        {
          managerId: scaffold.managerB.id,
          processId: scaffold.proc.id,
          lifecycleStageId: scaffold.productionStatus.id,
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  it('lists the run in the queue for both permitted managers before anyone claims it', async () => {
    const queueA = await service.listQueue(scaffold.managerA.id);
    const queueB = await service.listQueue(scaffold.managerB.id);
    expect(queueA.map((r) => r.id)).toContain(scaffold.run.id);
    expect(queueB.map((r) => r.id)).toContain(scaffold.run.id);
  });

  it('only lets one of two concurrent claims succeed', async () => {
    const results = await Promise.allSettled([
      service.claim(scaffold.managerA.id, scaffold.run.id),
      service.claim(scaffold.managerB.id, scaffold.run.id),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const run = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: scaffold.run.id },
    });
    expect(run.claimedBy).not.toBeNull();
    expect([scaffold.managerA.id, scaffold.managerB.id]).toContain(
      run.claimedBy,
    );
  });

  it('removes the claimed run from the other manager queue and shows it only in the claimant active list', async () => {
    const run = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: scaffold.run.id },
    });
    const claimant = run.claimedBy as string;
    const other =
      claimant === scaffold.managerA.id
        ? scaffold.managerB.id
        : scaffold.managerA.id;

    const otherQueue = await service.listQueue(other);
    expect(otherQueue.map((r) => r.id)).not.toContain(scaffold.run.id);

    const claimantActive = await service.listActive(claimant);
    expect(claimantActive.map((r) => r.id)).toContain(scaffold.run.id);
  });

  it('rejects release from a manager who does not hold the claim', async () => {
    const run = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: scaffold.run.id },
    });
    const claimant = run.claimedBy as string;
    const other =
      claimant === scaffold.managerA.id
        ? scaffold.managerB.id
        : scaffold.managerA.id;

    await expect(service.release(other, scaffold.run.id)).rejects.toThrow();
  });

  it('completes the stage, advances lifecycle, records history, and clears the claim', async () => {
    const before = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: scaffold.run.id },
    });
    const claimant = before.claimedBy as string;

    const result = await service.complete(claimant, scaffold.run.id);
    expect(result.status).toBe('WAITING');

    const after = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: scaffold.run.id },
    });
    expect(after.lifeCycleStatusCode).toBe('WAITING');
    expect(after.claimedBy).toBeNull();
    expect(after.claimedAt).toBeNull();
    expect(after.executorId).toBe(claimant);

    const history = await testPrisma.processRunStageHistory.findMany({
      where: { processRunId: scaffold.run.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0].managerId).toBe(claimant);
    expect(history[0].lifecycleStageId).toBe(scaffold.productionStatus.id);
    expect(history[0].durationSeconds).toBeGreaterThanOrEqual(0);
  });
});
