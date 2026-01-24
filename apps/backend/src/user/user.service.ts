import type {
    AssignLocationDto,
    SyncUserDto,
} from '@app/contracts';
import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'apps/backend/prisma/prisma.service';

@Injectable()
export class UserService {
    private readonly log = new Logger(UserService.name);

    constructor(private readonly prisma: PrismaService) { }

    /* ===========================
       CREATE / UPDATE
    ============================ */

    async syncUser(dto: SyncUserDto) {
        const user = await this.prisma.user.upsert({
            where: { email: dto.email },
            update: {
                name: dto.name,
                isActive: true,
                deletedAt: null,
            },
            create: {
                email: dto.email,
                name: dto.name,
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
}
