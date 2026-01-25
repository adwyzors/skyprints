import type {
    AssignLocationDto,
    SyncUserDto,
} from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { ContextLogger } from '../common/logger/context.logger';
import { UsersQueryDto } from '../dto/users-query.dto';

@Injectable()
export class UserService {
    private readonly log = new ContextLogger(UserService.name);

    constructor(private readonly prisma: PrismaService) { }

    /* ===========================
       CREATE / UPDATE
    ============================ */

    async syncUser(dto: SyncUserDto) {
        const now = new Date();

        const user = await this.prisma.user.upsert({
            where: { email: dto.email },
            update: {
                name: dto.name,
                role: dto.role,
                isActive: true,
                deletedAt: null,
                updatedAt: now,
            },
            create: {
                id: dto.id,
                email: dto.email,
                name: dto.name,
                role: dto.role,
                isActive: true,
                createdAt: now,
                updatedAt: now,
            },
        });
        this.log.log(`User synced email=${user.email}`);
        return user;
    }

    /* ===========================
       SOFT DELETE
    ============================ */

    async softDeleteByEmail(email: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user || user.deletedAt) {
            throw new NotFoundException('User not found or already deleted');
        }

        await this.prisma.user.update({
            where: { email },
            data: {
                isActive: false,
                deletedAt: new Date(),
                locationId: null, // 🔥 detach location
            },
        });

        this.log.warn(`User soft-deleted email=${email}`);
    }

    /* ===========================
       LOCATION ASSIGNMENT (1–1)
    ============================ */

    async assignLocation(dto: AssignLocationDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user || user.deletedAt) {
            throw new NotFoundException('User not found');
        }

        // Unassign location
        if (dto.locationCode === null) {
            await this.prisma.user.update({
                where: { email: dto.email },
                data: { locationId: null },
            });

            this.log.log(`Location unassigned email=${dto.email}`);
            return;
        }

        const location = await this.prisma.location.findUnique({
            where: { code: dto.locationCode },
        });

        if (!location || !location.isActive) {
            throw new BadRequestException('Invalid or inactive location');
        }

        await this.prisma.user.update({
            where: { email: dto.email },
            data: { locationId: location.id },
        });

        this.log.log(
            `Location assigned email=${dto.email} location=${location.code}`
        );
    }

    async getAll(query: UsersQueryDto) {
        const { role } = query;

        // Normalize roles (ADMIN,OPERATOR → [ADMIN, OPERATOR])
        const roles = role
            ? role
                .split(',')
                .map(r => r.trim())
                .filter(Boolean)
            : undefined;

        const where = {
            deletedAt: null,
            ...(roles?.length === 1 && { role: roles[0] }),
            ...(roles && roles.length > 1 && {
                role: { in: roles },
            }),
        };

        const users = await this.prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
                deletedAt: false,
            },
        });

        return {
            data: users,
            meta: {
                total: users.length,
            },
        };
    }

}
