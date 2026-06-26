/**
 * Integration tests for DynamicWorkflowEngine.
 *
 * Requires a running PostgreSQL test DB. Set DATABASE_URL in .env.test and run:
 *   npm run db:test:push          # sync schema once
 *   npm run test:integration      # run these tests
 */
import { BadRequestException } from '@nestjs/common';
import { cleanDatabase, seedSimpleWorkflow } from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowRepository } from './workflow.repository';
import { DynamicWorkflowEngine } from './workflow.engine';

describe('DynamicWorkflowEngine (integration)', () => {
  const testPrisma = getTestPrisma();

  // PrismaService wraps the global singleton. We need it to point at test DB,
  // so DATABASE_URL must be set by dotenv -e .env.test before Jest starts.
  const prismaService = new PrismaService();
  const repo = new WorkflowRepository(prismaService);
  const engine = new DynamicWorkflowEngine(repo);

  beforeAll(async () => {
    await cleanDatabase(testPrisma);

    // Create workflow: START → MIDDLE (no condition), MIDDLE → END (condition: qty > 0)
    await seedSimpleWorkflow(
      testPrisma,
      'WF_BASIC',
      ['START', 'MIDDLE', 'END'],
      [
        ['START', 'MIDDLE'],
        ['MIDDLE', 'END', 'qty > 0'],
      ],
    );

    // An inactive workflow to test guard
    await testPrisma.workflowType.create({
      data: { code: 'WF_INACTIVE', isActive: false },
    });
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── Happy paths ──────────────────────────────────────────────────────────

  it('allows a valid unconditional transition', async () => {
    await expect(
      engine.validateTransition('WF_BASIC', 'START', 'MIDDLE', {}),
    ).resolves.toBeUndefined();
  });

  it('allows a conditional transition when condition is satisfied', async () => {
    await expect(
      engine.validateTransition('WF_BASIC', 'MIDDLE', 'END', { qty: 10 }),
    ).resolves.toBeUndefined();
  });

  // ── Error paths ──────────────────────────────────────────────────────────

  it('rejects a transition that has no defined path', async () => {
    await expect(
      engine.validateTransition('WF_BASIC', 'START', 'END', {}),
    ).rejects.toThrow(BadRequestException);

    await expect(
      engine.validateTransition('WF_BASIC', 'START', 'END', {}),
    ).rejects.toThrow('Invalid status transition');
  });

  it('rejects a transition whose condition fails', async () => {
    await expect(
      engine.validateTransition('WF_BASIC', 'MIDDLE', 'END', { qty: 0 }),
    ).rejects.toThrow('Transition condition failed');
  });

  it('rejects an inactive workflow type', async () => {
    await expect(
      engine.validateTransition('WF_INACTIVE', 'START', 'END', {}),
    ).rejects.toThrow('Invalid workflow type');
  });

  it('rejects a completely unknown workflow type', async () => {
    await expect(
      engine.validateTransition('WF_NONEXISTENT', 'A', 'B', {}),
    ).rejects.toThrow('Invalid workflow type');
  });

  it('rejects a reverse transition not in the definition', async () => {
    await expect(
      engine.validateTransition('WF_BASIC', 'MIDDLE', 'START', {}),
    ).rejects.toThrow('Invalid status transition');
  });
});
