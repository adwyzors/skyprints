import { Module } from '@nestjs/common';
import { RunTemplatesController } from './run-templates.controller';
import { RunTemplatesService } from './run-templates.service';
import { RunTemplateValidator } from './run-template.validator';
import { PrismaService } from 'prisma/prisma.service';

@Module({
    controllers: [RunTemplatesController],
    providers: [
        RunTemplatesService,
        RunTemplateValidator,
    ],
    exports: [RunTemplatesService],
})
export class RunTemplatesModule { }
