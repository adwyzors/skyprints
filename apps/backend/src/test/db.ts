import { PrismaClient } from '@prisma/client';

// Safety guard: refuse to wipe data on non-test DB URLs
function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? '';
  if (
    url.includes('supabase.com') ||
    url.includes('digitalocean') ||
    url.includes('neon.tech')
  ) {
    const isTestUrl =
      url.includes('_test') ||
      url.includes('test_') ||
      url.includes('/skyprints_test');
    if (!isTestUrl) {
      throw new Error(
        'cleanDatabase() refused: DATABASE_URL looks like a production/shared DB. ' +
          'Set DATABASE_URL to a dedicated test database in .env.test.',
      );
    }
  }
}

/**
 * Deletes all test data in safe FK order.
 * Call in afterEach/afterAll to keep tests isolated.
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  assertTestDatabase();
  // analytics / reporting (no FK to core domain)
  await prisma.userPerformance.deleteMany();
  await prisma.orderAnalytics.deleteMany();
  await prisma.processAnalytics.deleteMany();
  await prisma.locationAnalytics.deleteMany();
  await prisma.dailyAnalytics.deleteMany();

  // billing
  await prisma.billingSnapshot.deleteMany();
  await prisma.billingContextOrder.deleteMany();
  await prisma.billingContext.deleteMany();

  // manager stage queue (must go before processRun/user deletes — FK restrict)
  await prisma.processRunStageHistory.deleteMany();
  await prisma.managerStagePermission.deleteMany();

  // order hierarchy
  await prisma.processRun.deleteMany();
  await prisma.orderProcess.deleteMany();
  await prisma.order.deleteMany();

  // catalogues
  await prisma.processRunDefinition.deleteMany();
  await prisma.runTemplate.deleteMany();
  await prisma.process.deleteMany();

  // workflow
  await prisma.workflowTransition.deleteMany();
  await prisma.workflowStatus.deleteMany();
  await prisma.workflowType.deleteMany();

  // sequences & users
  await prisma.fiscalSequence.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
}

// ─── Seed helpers ────────────────────────────────────────────────────────────

export async function seedSimpleWorkflow(
  prisma: PrismaClient,
  code: string,
  statuses: string[],
  transitions: [string, string, string?][],
) {
  const wf = await prisma.workflowType.create({
    data: { code, isActive: true },
  });

  const statusMap: Record<string, string> = {};
  for (let i = 0; i < statuses.length; i++) {
    const s = await prisma.workflowStatus.create({
      data: {
        workflowTypeId: wf.id,
        code: statuses[i],
        isInitial: i === 0,
        isTerminal: i === statuses.length - 1,
      },
    });
    statusMap[statuses[i]] = s.id;
  }

  for (const [from, to, condition] of transitions) {
    await prisma.workflowTransition.create({
      data: {
        workflowTypeId: wf.id,
        fromStatusId: statusMap[from],
        toStatusId: statusMap[to],
        condition: condition ?? null,
      },
    });
  }

  return { wf, statusMap };
}

export async function seedRunTemplate(
  prisma: PrismaClient,
  opts: {
    name: string;
    billingFormula: string;
    configWorkflowTypeId: string;
    lifecycleWorkflowTypeId: string;
    fields?: object;
  },
) {
  return prisma.runTemplate.create({
    data: {
      name: opts.name,
      billingFormula: opts.billingFormula,
      fields: opts.fields ?? [],
      configWorkflowTypeId: opts.configWorkflowTypeId,
      lifecycleWorkflowTypeId: opts.lifecycleWorkflowTypeId,
    },
  });
}

export async function seedProcess(
  prisma: PrismaClient,
  runTemplateId: string,
  name = 'Test Process',
) {
  const proc = await prisma.process.create({
    data: { name, isEnabled: true },
  });
  await prisma.processRunDefinition.create({
    data: {
      processId: proc.id,
      runTemplateId,
      displayName: name,
      sortOrder: 1,
    },
  });
  return proc;
}

export async function seedCustomer(
  prisma: PrismaClient,
  overrides: Partial<{ code: string; name: string; creditLimit: number }> = {},
) {
  return prisma.customer.create({
    data: {
      code: overrides.code ?? 'TEST_CUST',
      name: overrides.name ?? 'Test Customer',
      creditLimit: overrides.creditLimit ?? 0,
      outstandingAmount: 0,
    },
  });
}

export async function seedUser(
  prisma: PrismaClient,
  overrides: Partial<{ email: string; name: string; role: string }> = {},
) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'test@test.com',
      name: overrides.name ?? 'Test User',
      role: overrides.role ?? 'ADMIN',
    },
  });
}

export async function seedOrder(
  prisma: PrismaClient,
  opts: {
    customerId: string;
    createdById: string;
    statusCode?: string;
    quantity?: number;
    estimatedAmount?: number;
    isTest?: boolean;
    code?: string;
  },
) {
  return prisma.order.create({
    data: {
      code: opts.code ?? `TESTORD-${Date.now()}`,
      customerId: opts.customerId,
      createdById: opts.createdById,
      statusCode: (opts.statusCode ?? 'CONFIGURE') as any,
      quantity: opts.quantity ?? 10,
      estimatedAmount: opts.estimatedAmount ?? 0,
      isTest: opts.isTest ?? true,
    },
  });
}
