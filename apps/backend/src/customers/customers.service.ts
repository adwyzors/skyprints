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

        return this.repo.create({
            ...dto,
            code,
        });
    }


    async findAll(query: QueryCustomerDto) {
        const {
            page = 1,
            limit = 10,
            search,
            isActive,
        } = query;

        const skip = (page - 1) * limit;

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
                ],
            }),
        };

        const [total, customers] = await this.repo.findManyAndCount({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });

        return {
            data: customers.map(toCustomerSummary),
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

    //async deactivate(id: string) {
    //    await this.findOne(id);
    //    return this.repo.update(id, { isActive: false });
    //}
}
