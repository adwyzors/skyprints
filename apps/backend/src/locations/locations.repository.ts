import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'apps/backend/prisma/prisma.service';

@Injectable()
export class LocationsRepository {
    constructor(private readonly prisma: PrismaService) { }

    create(data: Prisma.LocationCreateInput) {
        return this.prisma.location.create({ data });
    }

    findById(id: string) {
        return this.prisma.location.findUnique({ where: { id } });
    }

    findByCode(code: string) {
        return this.prisma.location.findUnique({ where: { code } });
    }

    findMany(params: {
        where?: Prisma.LocationWhereInput;
        skip?: number;
        take?: number;
    }) {
        return this.prisma.location.findMany({
            ...params,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findManyAndCount(args: {
        where?: Prisma.LocationWhereInput;
        skip?: number;
        take?: number;
        orderBy?: Prisma.LocationOrderByWithRelationInput;
    }) {
        const [total, data] = await this.prisma.transaction([
            this.prisma.location.count({ where: args.where }),
            this.prisma.location.findMany({
                where: args.where,
                skip: args.skip,
                take: args.take,
                orderBy: args.orderBy,
            }),
        ]);

        return [total, data] as const;
    }

    update(id: string, data: Prisma.LocationUpdateInput) {
        return this.prisma.location.update({
            where: { id },
            data,
        });
    }
}
