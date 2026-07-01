/**
 * Integration tests for UsersService stage-permission endpoints:
 * role validation, process/stage consistency validation, replace-all
 * semantics, and the incremental in-flight claim backfill.
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
import { UsersService } from './users.service';

describe('UsersService stage permissions (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const service = new UsersService(prismaService);

  let processA: Awaited<ReturnType<typeof seedProcess>>;
  let processB: Awaited<ReturnType<typeof seedProcess>>;
  let stageA1: { id: string };
  let stageA2: { id: string };
  let stageB1: { id: string };
  let manager: Awaited<ReturnType<typeof seedUser>>;
  let admin: Awaited<ReturnType<typeof seedUser>>;

  beforeAll(async () => {
    await cleanDatabase(testPrisma);

    const { wf: configWf } = await seedSimpleWorkflow(
      testPrisma,
      'SP_CFG_WF',
      ['CONFIGURE', 'COMPLETE'],
      [['CONFIGURE', 'COMPLETE']],
    );

    const { wf: lifecycleWfA } = await seedSimpleWorkflow(
      testPrisma,
      'SP_LC_WF_A',
      ['TRACING', 'PRODUCTION', 'COMPLETE'],
      [
        ['TRACING', 'PRODUCTION'],
        ['PRODUCTION', 'COMPLETE'],
      ],
    );
    const { wf: lifecycleWfB } = await seedSimpleWorkflow(
      testPrisma,
      'SP_LC_WF_B',
      ['CUTTING', 'COMPLETE'],
      [['CUTTING', 'COMPLETE']],
    );

    const templateA = await seedRunTemplate(testPrisma, {
      name: 'SP Template A',
      billingFormula: 'quantity * new_rate',
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWfA.id,
    });
    const templateB = await seedRunTemplate(testPrisma, {
      name: 'SP Template B',
      billingFormula: 'quantity * new_rate',
      configWorkflowTypeId: configWf.id,
      lifecycleWorkflowTypeId: lifecycleWfB.id,
    });

    processA = await seedProcess(testPrisma, templateA.id, 'SP Process A');
    processB = await seedProcess(testPrisma, templateB.id, 'SP Process B');

    stageA1 = await testPrisma.workflowStatus.findFirstOrThrow({
      where: { workflowTypeId: lifecycleWfA.id, code: 'TRACING' },
    });
    stageA2 = await testPrisma.workflowStatus.findFirstOrThrow({
      where: { workflowTypeId: lifecycleWfA.id, code: 'PRODUCTION' },
    });
    stageB1 = await testPrisma.workflowStatus.findFirstOrThrow({
      where: { workflowTypeId: lifecycleWfB.id, code: 'CUTTING' },
    });

    manager = await seedUser(testPrisma, {
      email: 'sp-manager@test.com',
      name: 'SP Manager',
      role: 'MANAGER',
    });
    admin = await seedUser(testPrisma, {
      email: 'sp-admin@test.com',
      name: 'SP Admin',
      role: 'ADMIN',
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  it('rejects assigning stage permissions to a non-MANAGER user', async () => {
    await expect(
      service.updateStagePermissions(admin.id, [
        { processId: processA.id, lifecycleStageId: stageA1.id },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a stage that does not belong to the given process', async () => {
    await expect(
      service.updateStagePermissions(manager.id, [
        { processId: processA.id, lifecycleStageId: stageB1.id },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('assigns valid entries and replace-all on subsequent save', async () => {
    await service.updateStagePermissions(manager.id, [
      { processId: processA.id, lifecycleStageId: stageA1.id },
      { processId: processA.id, lifecycleStageId: stageA2.id },
    ]);

    let assigned = await service.getStagePermissions(manager.id);
    expect(assigned).toHaveLength(2);
    expect(assigned.map((a) => a.lifecycleStageId).sort()).toEqual(
      [stageA1.id, stageA2.id].sort(),
    );

    // Replace-all: saving a smaller set drops the rest
    await service.updateStagePermissions(manager.id, [
      { processId: processA.id, lifecycleStageId: stageA1.id },
    ]);
    assigned = await service.getStagePermissions(manager.id);
    expect(assigned).toHaveLength(1);
    expect(assigned[0].lifecycleStageId).toBe(stageA1.id);
  });

  it('backfills claimedBy from executorId for in-flight runs when a pair is newly covered', async () => {
    // Reset to no assignments, so the next save of stageA2 is "newly covered"
    await service.updateStagePermissions(manager.id, []);

    const customer = await seedCustomer(testPrisma, {
      code: 'SP_CUST',
      name: 'SP Customer',
    });
    const order = await seedOrder(testPrisma, {
      customerId: customer.id,
      createdById: admin.id,
      statusCode: 'IN_PRODUCTION',
      isTest: true,
    });
    const orderProcess = await testPrisma.orderProcess.create({
      data: { orderId: order.id, processId: processA.id, statusCode: 'IN_PROGRESS' },
    });

    const templateA = await testPrisma.runTemplate.findFirstOrThrow({
      where: { name: 'SP Template A' },
    });

    // In-flight run: already at PRODUCTION, already has an executor, unclaimed
    const run = await testPrisma.processRun.create({
      data: {
        orderProcessId: orderProcess.id,
        runTemplateId: templateA.id,
        runNumber: 1,
        displayName: 'SP Run 1',
        configWorkflowTypeId: templateA.configWorkflowTypeId,
        lifecycleWorkflowTypeId: templateA.lifecycleWorkflowTypeId,
        statusCode: 'IN_PROGRESS',
        lifeCycleStatusCode: 'PRODUCTION',
        fields: {},
        executorId: admin.id,
      },
    });

    await testPrisma.processRunLifecycleHistory.create({
      data: {
        processRunId: run.id,
        statusCode: 'PRODUCTION',
        completedAt: null,
      },
    });

    // First save covering (processA, stageA2/PRODUCTION) for the first time ever
    await service.updateStagePermissions(manager.id, [
      { processId: processA.id, lifecycleStageId: stageA2.id },
    ]);

    const afterBackfill = await testPrisma.processRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(afterBackfill.claimedBy).toBe(admin.id);
    expect(afterBackfill.claimedAt).not.toBeNull();
  });
});
