import type { CreateCustomerDto, QueryCustomerDto } from '@app/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { toCustomerSummary } from '../mappers/customer.mapper';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async create(dto: CreateCustomerDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.repo.findByCode(code);
    if (existing) {
      throw new ConflictException('Customer code already exists');
    }

    if (dto.gstno) {
      const existingGst = await this.repo.findByGst(dto.gstno);
      if (existingGst) {
        throw new ConflictException(
          'Customer with this GST number already exists',
        );
      }
    }

    return this.repo.create({
      ...dto,
      code,
    });
  }

  async update(id: string, dto: Partial<CreateCustomerDto>) {
    const customer = await this.findOne(id);

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      if (code !== customer.code) {
        const existing = await this.repo.findByCode(code);
        if (existing) {
          throw new ConflictException('Customer code already exists');
        }
        dto.code = code;
      }
    }

    if (dto.gstno && dto.gstno !== customer.gstno) {
      const existingGst = await this.repo.findByGst(dto.gstno);
      if (existingGst) {
        throw new ConflictException(
          'Customer with this GST number already exists',
        );
      }
    }

    return this.repo.update(id, dto);
  }

  async findAll(query: QueryCustomerDto) {
    const { page = 1, limit, search, isActive } = query;

    const where: Prisma.CustomerWhereInput = {
      ...(typeof isActive === 'boolean' && { isActive }),

      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            code: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            gstno: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };
    const skip = limit ? (page - 1) * limit : undefined;

    const [total, customers] = await this.repo.findManyAndCount({
      where,
      ...(limit && {
        skip,
        take: limit,
      }),
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: customers.map(toCustomerSummary),
      meta: {
        page,
        limit: limit ?? total, // show total if no limit
        total,
        totalPages: limit ? Math.ceil(total / limit) : 1,
      },
    };
  }

  async findOne(id: string) {
    const customer = await this.repo.findById(id);
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.repo.softDelete(id);
  }

  async softDeleteMany(ids: string[]) {
    return this.repo.softDeleteMany(ids);
  }

  /* =========================
   * Export Customers to Excel
   * ========================= */
  async exportToExcel(res: Response) {
    // Fetch ALL active customers sorted alphabetically by name
    const customers = await this.repo.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Skyprints';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Customers');

    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 38 },
      { header: 'Customer Name', key: 'name', width: 30 },
      { header: 'Code', key: 'code', width: 12 },
      { header: 'Outstanding Amount', key: 'outstandingAmount', width: 22 },
      { header: 'Credit Limit', key: 'creditLimit', width: 16 },
    ];

    // Bold header, default Excel colors
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.height = 18;

    // Add data rows — explicitly cast Prisma Decimal to Number so ExcelJS
    // writes proper numeric cells instead of quoted strings
    customers.forEach((customer, index) => {
      const outstandingAmount = Number(customer.outstandingAmount);
      const creditLimit = Number(customer.creditLimit);

      const row = worksheet.addRow({
        id: customer.id,
        name: customer.name,
        code: customer.code,
        outstandingAmount,
        creditLimit,
      });

      // Explicitly set cell type to number (belt-and-suspenders)
      const outCell = row.getCell('outstandingAmount');
      outCell.value = outstandingAmount;
      outCell.numFmt = '#,##0.00';

      const creditCell = row.getCell('creditLimit');
      creditCell.value = creditLimit;
      creditCell.numFmt = '#,##0.00';

      // Alternate row background
      if (index % 2 === 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F7FF' },
        };
      }
    });

    // Freeze the header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Add note about editable fields
    const lastRow = worksheet.lastRow;
    if (lastRow) {
      worksheet.getCell(`A${lastRow.number + 2}`).value =
        'Note: Only "Outstanding Amount" and "Credit Limit" columns are updated on upload. Do not change the ID column.';
      worksheet.getCell(`A${lastRow.number + 2}`).font = {
        italic: true,
        color: { argb: 'FF6B7280' },
      };
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=customers_${new Date().toISOString().split('T')[0]}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  /* =========================
   * Import Customers from Excel
   * ========================= */
  async importFromExcel(buffer: Buffer): Promise<{
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer));

    const worksheet = workbook.getWorksheet('Customers');
    if (!worksheet) {
      throw new BadRequestException(
        'Invalid Excel file: "Customers" sheet not found.',
      );
    }

    // Read header row to find column indices
    const headerRow = worksheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').trim();
      headers[val] = colNumber;
    });

    const idCol = headers['ID'];
    const outstandingCol = headers['Outstanding Amount'];
    const creditLimitCol = headers['Credit Limit'];

    if (!idCol || !outstandingCol || !creditLimitCol) {
      throw new BadRequestException(
        'Invalid Excel file: Required columns (ID, Outstanding Amount, Credit Limit) not found.',
      );
    }

    const updates: { id: string; outstandingAmount: number; creditLimit: number }[] = [];
    const errors: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const id = String(row.getCell(idCol).value || '').trim();
      // Skip empty rows or rows that don't contain a valid UUID (e.g. the note row at the bottom)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) return;

      const rawOutstanding = row.getCell(outstandingCol).value;
      const rawCredit = row.getCell(creditLimitCol).value;

      const outstandingAmount = parseFloat(String(rawOutstanding ?? '').replace(/,/g, ''));
      const creditLimit = parseFloat(String(rawCredit ?? '').replace(/,/g, ''));

      if (isNaN(outstandingAmount) || isNaN(creditLimit)) {
        errors.push(`Row ${rowNumber}: Invalid numeric values for ID "${id}".`);
        return;
      }

      updates.push({ id, outstandingAmount, creditLimit });
    });

    let updated = 0;
    let skipped = 0;

    for (const item of updates) {
      try {
        const customer = await this.repo.findById(item.id);
        if (!customer) {
          errors.push(`Customer with ID "${item.id}" not found, skipped.`);
          skipped++;
          continue;
        }
        await this.repo.update(item.id, {
          outstandingAmount: item.outstandingAmount,
          creditLimit: item.creditLimit,
        });
        updated++;
      } catch {
        errors.push(`Failed to update customer ID "${item.id}".`);
        skipped++;
      }
    }

    return { updated, skipped, errors };
  }
}
