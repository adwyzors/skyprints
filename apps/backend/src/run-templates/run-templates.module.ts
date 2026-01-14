import { Module } from '@nestjs/common';
import { RunTemplatesController } from './run-templates.controller';
import { RunTemplatesService } from './run-templates.service';

@Module({
    controllers: [RunTemplatesController],
    providers: [
        RunTemplatesService,
    ],
    exports: [RunTemplatesService],
})
export class RunTemplatesModule { }
