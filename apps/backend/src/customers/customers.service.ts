import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  async create(dto: CreateCustomerDto) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException('Customer code already exists');
    }

    return this.repo.create({
      ...dto,
    });
  }

  async findAll(query: QueryCustomerDto) {
  const { page, limit, search, isActive } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.CustomerWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (search) {
    where.OR = [
      {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        code: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      {
        email: {
          contains: search,
          mode: Prisma.QueryMode.insensitive,
        },
      },
    ];
  }

  const [data, total] = await Promise.all([
    this.repo.findMany({ where, skip, take: limit }),
    this.repo.count(where),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
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

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.repo.update(id, { isActive: false });
  }
}
