import { CreateLocationDto, QueryLocationDto } from '@app/contracts';
import {
    ConflictException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toLocationSummary } from '../mappers/location.mapper';
import { LocationsRepository } from './locations.repository';

@Injectable()
export class LocationsService {
    constructor(private readonly repo: LocationsRepository) { }

    async create(dto: CreateLocationDto) {
        const code = dto.code.trim().toUpperCase();

        const existing = await this.repo.findByCode(code);
        if (existing) {
            throw new ConflictException('Location code already exists');
        }

        return this.repo.create({
            ...dto,
            code,
        });
    }

    async update(id: string, dto: Partial<CreateLocationDto>) {
        const location = await this.findOne(id);

        if (dto.code) {
            const code = dto.code.trim().toUpperCase();
            if (code !== location.code) {
                const existing = await this.repo.findByCode(code);
                if (existing) {
                    throw new ConflictException('Location code already exists');
                }
                dto.code = code;
            }
        }

        return this.repo.update(id, dto);
    }


    async findAll(query: QueryLocationDto) {
        const { page = 1, limit, search, isActive } = query;

        const where: Prisma.LocationWhereInput = {
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

        const [total, locations] = await this.repo.findManyAndCount({
            where,
            ...(limit && {
                skip: (page - 1) * limit,
                take: limit,
            }),
            orderBy: { createdAt: 'desc' },
        });

        return {
            data: locations.map(toLocationSummary),
            meta: {
                page: limit ? page : 1,
                limit: limit ?? total,
                total,
                totalPages: limit ? Math.ceil(total / limit) : 1,
            },
        };
    }

    async findOne(id: string) {
        const location = await this.repo.findById(id);
        if (!location) {
            throw new NotFoundException('Location not found');
        }
        return location;
    }

    async delete(id: string) {
        await this.findOne(id);
        return this.repo.update(id, { isActive: false });
    }
}
