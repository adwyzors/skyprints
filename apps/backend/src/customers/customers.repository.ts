import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'apps/backend/prisma/prisma.service';

@Injectable()
export class CustomersRepository {
    constructor(private readonly prisma: PrismaService) { }

    create(data: Prisma.CustomerCreateInput) {
        return this.prisma.customer.create({ data });
    }

    findById(id: string) {
        return this.prisma.customer.findFirst({
            where: { id, deletedAt: null }
        });
    }

    findByCode(code: string) {
        return this.prisma.customer.findFirst({
            where: { code, deletedAt: null }
        });
    }

    findMany(params: {
        where?: Prisma.CustomerWhereInput;
        skip?: number;
        take?: number;
    }) {
        return this.prisma.customer.findMany({
            where: {
                ...params.where,
                deletedAt: null,
            },
            skip: params.skip,
            take: params.take,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findManyAndCount(args: {
        where?: Prisma.CustomerWhereInput;
        skip?: number;
        take?: number;
        orderBy?: Prisma.CustomerOrderByWithRelationInput;
    }) {
        const where = {
            ...args.where,
            deletedAt: null,
        };

        const [total, data] = await this.prisma.transaction([
            this.prisma.customer.count({ where }),
            this.prisma.customer.findMany({
                where,
                skip: args.skip,
                take: args.take,
                orderBy: args.orderBy,
            }),
        ]);

        return [total, data] as const;
    }

    count(where?: Prisma.CustomerWhereInput) {
        return this.prisma.customer.count({
            where: { ...where, deletedAt: null }
        });
    }

    update(id: string, data: Prisma.CustomerUpdateInput) {
        return this.prisma.customer.update({
            where: { id },
            data,
        });
    }

    softDelete(id: string) {
        return this.prisma.customer.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                isActive: false
            },
        });
    }

    softDeleteMany(ids: string[]) {
        return this.prisma.customer.updateMany({
            where: { id: { in: ids } },
            data: {
                deletedAt: new Date(),
                isActive: false
            },
        });
    }

    findByGst(gstno: string) {
        return this.prisma.customer.findFirst({
            where: { gstno, deletedAt: null }
        });
    }
}
