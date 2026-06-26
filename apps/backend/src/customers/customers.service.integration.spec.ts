/**
 * Integration tests for CustomersService.
 * Needs DATABASE_URL from .env.test → npm run test:integration
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { cleanDatabase } from '../test/db';
import { disconnectTestPrisma, getTestPrisma } from '../test/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';

const make = (overrides: { code: string; name: string; gstno?: string; creditLimit?: number }) => ({
  creditLimit: 0,
  outstandingAmount: 0,
  ...overrides,
});

describe('CustomersService (integration)', () => {
  const testPrisma = getTestPrisma();
  const prismaService = new PrismaService();
  const repo = new CustomersRepository(prismaService);
  const service = new CustomersService(repo);

  beforeEach(async () => {
    await cleanDatabase(testPrisma);
  });

  afterAll(async () => {
    await cleanDatabase(testPrisma);
    await disconnectTestPrisma();
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a customer and normalises code to uppercase', async () => {
      const customer = await service.create(make({ code: 'dots', name: 'Dots Garments Pvt Ltd' }));

      expect(customer.code).toBe('DOTS');
      expect(customer.name).toBe('Dots Garments Pvt Ltd');
      expect(customer.isActive).toBe(true);
      expect(customer.deletedAt).toBeNull();
    });

    it('throws ConflictException when code already exists', async () => {
      await service.create(make({ code: 'NCPL', name: 'First' }));

      await expect(service.create(make({ code: 'ncpl', name: 'Second' }))).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(make({ code: 'ncpl', name: 'Second' }))).rejects.toThrow(
        'Customer code already exists',
      );
    });

    it('throws ConflictException when GST number already exists', async () => {
      await service.create(make({ code: 'CUST1', name: 'First', gstno: '27ABCDE1234F1Z5' }));

      await expect(
        service.create(make({ code: 'CUST2', name: 'Second', gstno: '27ABCDE1234F1Z5' })),
      ).rejects.toThrow('Customer with this GST number already exists');
    });

    it('allows two customers with no GST number', async () => {
      await service.create(make({ code: 'C1', name: 'One' }));
      await expect(service.create(make({ code: 'C2', name: 'Two' }))).resolves.toBeDefined();
    });
  });

  // ── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the customer by id', async () => {
      const created = await service.create(make({ code: 'MAHAVIR', name: 'Mahavir Exports' }));
      const found = await service.findOne(created.id);
      expect(found.id).toBe(created.id);
      expect(found.code).toBe('MAHAVIR');
    });

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for soft-deleted customer', async () => {
      const customer = await service.create(make({ code: 'GONE', name: 'Gone Ltd' }));
      await service.softDelete(customer.id);

      await expect(service.findOne(customer.id)).rejects.toThrow(NotFoundException);
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the customer name', async () => {
      const customer = await service.create(make({ code: 'UPD', name: 'Old Name' }));
      const updated = await service.update(customer.id, { name: 'New Name' });
      expect(updated.name).toBe('New Name');
    });

    it('normalises code to uppercase on update', async () => {
      const customer = await service.create(make({ code: 'ORIG', name: 'Original' }));
      const updated = await service.update(customer.id, { code: 'newcode' });
      expect(updated.code).toBe('NEWCODE');
    });

    it('throws ConflictException when updating to an already-taken code', async () => {
      await service.create(make({ code: 'TAKEN', name: 'Taken' }));
      const other = await service.create(make({ code: 'OTHER', name: 'Other' }));

      await expect(service.update(other.id, { code: 'taken' })).rejects.toThrow(
        'Customer code already exists',
      );
    });

    it('does not conflict when code is unchanged', async () => {
      const customer = await service.create(make({ code: 'SAME', name: 'Same' }));
      await expect(
        service.update(customer.id, { code: 'SAME', name: 'Updated Name' }),
      ).resolves.toBeDefined();
    });

    it('throws ConflictException when updating to an already-taken GST number', async () => {
      await service.create(make({ code: 'G1', name: 'G1', gstno: '27GST0000001Z1' }));
      const other = await service.create(make({ code: 'G2', name: 'G2' }));

      await expect(service.update(other.id, { gstno: '27GST0000001Z1' })).rejects.toThrow(
        'Customer with this GST number already exists',
      );
    });
  });

  // ── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    beforeEach(async () => {
      await Promise.all([
        service.create(make({ code: 'ALPHA', name: 'Alpha Exports' })),
        service.create(make({ code: 'BETA', name: 'Beta Fabrics' })),
        service.create(make({ code: 'GAMMA', name: 'Gamma Garments', gstno: '27GGG000001Z1' })),
      ]);
    });

    it('returns all active customers', async () => {
      const result = await service.findAll({ page: 1 });
      expect(result.data.length).toBe(3);
    });

    it('searches by name (case-insensitive)', async () => {
      const result = await service.findAll({ page: 1, search: 'exports' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].code).toBe('ALPHA');
    });

    it('searches by code (case-insensitive)', async () => {
      const result = await service.findAll({ page: 1, search: 'beta' });
      expect(result.data.length).toBe(1);
    });

    it('searches by GST number', async () => {
      const result = await service.findAll({ page: 1, search: '27GGG' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].code).toBe('GAMMA');
    });

    it('excludes soft-deleted customers', async () => {
      const { data } = await service.findAll({ page: 1 });
      const toDelete = data[0];
      await service.softDelete(toDelete.id);

      const result = await service.findAll({ page: 1 });
      expect(result.data.length).toBe(2);
      expect(result.data.find((c) => c.id === toDelete.id)).toBeUndefined();
    });

    it('paginates results', async () => {
      const page1 = await service.findAll({ page: 1, limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.meta.total).toBe(3);
      expect(page1.meta.totalPages).toBe(2);
    });
  });

  // ── softDelete ───────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets deletedAt and isActive=false', async () => {
      const customer = await service.create(make({ code: 'DEL', name: 'Delete Me' }));
      await service.softDelete(customer.id);

      const raw = await testPrisma.customer.findUnique({ where: { id: customer.id } });
      expect(raw!.deletedAt).not.toBeNull();
      expect(raw!.isActive).toBe(false);
    });

    it('throws NotFoundException when deleting non-existent customer', async () => {
      await expect(service.softDelete('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDeleteMany ────────────────────────────────────────────────────────

  describe('softDeleteMany', () => {
    it('soft-deletes multiple customers in one call', async () => {
      const c1 = await service.create(make({ code: 'M1', name: 'Multi 1' }));
      const c2 = await service.create(make({ code: 'M2', name: 'Multi 2' }));

      await service.softDeleteMany([c1.id, c2.id]);

      const result = await service.findAll({ page: 1 });
      expect(result.data.find((c) => c.id === c1.id)).toBeUndefined();
      expect(result.data.find((c) => c.id === c2.id)).toBeUndefined();
    });
  });
});
