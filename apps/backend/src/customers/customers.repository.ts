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
        return this.prisma.customer.findUnique({ where: { id } });
    }

    findByCode(code: string) {
        return this.prisma.customer.findUnique({ where: { code } });
    }

    findMany(params: {
        where?: Prisma.CustomerWhereInput;
        skip?: number;
        take?: number;
    }) {
        return this.prisma.customer.findMany({
            ...params,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findManyAndCount(args: {
        where?: Prisma.CustomerWhereInput;
        skip?: number;
        take?: number;
        orderBy?: Prisma.CustomerOrderByWithRelationInput;
    }) {
        const [total, data] = await this.prisma.transaction([
            this.prisma.customer.count({ where: args.where }),
            this.prisma.customer.findMany({
                where: args.where,
                skip: args.skip,
                take: args.take,
                orderBy: args.orderBy,
            }),
        ]);

        return [total, data] as const;
    }



    count(where?: Prisma.CustomerWhereInput) {
        return this.prisma.customer.count({ where });
    }

    update(id: string, data: Prisma.CustomerUpdateInput) {
        return this.prisma.customer.update({
            where: { id },
            data,
        });
    }
}
