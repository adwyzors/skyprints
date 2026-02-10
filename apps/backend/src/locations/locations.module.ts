import { Module } from '@nestjs/common';
import { PrismaService } from 'apps/backend/prisma/prisma.service';
import { LocationsController } from './locations.controller';
import { LocationsRepository } from './locations.repository';
import { LocationsService } from './locations.service';

@Module({
    controllers: [LocationsController],
    providers: [
        LocationsService,
        LocationsRepository,
        PrismaService,
    ],
    exports: [LocationsService],
})
export class LocationsModule { }
