import type { CreateCustomerDto, QueryCustomerDto } from '@app/contracts';
import {
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toCustomerSummary } from '../mappers/customer.mapper';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
    constructor(private readonly repo: CustomersRepository) { }

    async create(dto: CreateCustomerDto) {
        const code = dto.code.trim().toUpperCase();

        const existing = await this.repo.findByCode(code);
        if (existing) {
            throw new ConflictException('Customer code already exists');
        }

        if (dto.gstno) {
            const existingGst = await this.repo.findByGst(dto.gstno);
            if (existingGst) {
                throw new ConflictException('Customer with this GST number already exists');
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
                throw new ConflictException('Customer with this GST number already exists');
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
}
