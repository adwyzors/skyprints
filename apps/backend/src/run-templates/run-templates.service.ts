import {
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRunTemplateDto } from './dto/create-run-template.dto';
import { UpdateRunTemplateDto } from './dto/update-run-template.dto';
import { RunTemplateValidator } from './run-template.validator';

type RunTemplateFieldJson = {
    key: string;
    type: string;
    required?: boolean;
};

@Injectable()
export class RunTemplatesService {
    private readonly logger = new Logger(
        RunTemplatesService.name,
    );

    constructor(
        private readonly prisma: PrismaService,
        private readonly validator: RunTemplateValidator,
    ) { }

    async create(dto: CreateRunTemplateDto) {
        this.validator.validate(dto.fields);

        const fieldsJson: RunTemplateFieldJson[] = dto.fields.map(f => ({
            key: f.key,
            type: f.type,
            required: f.required ?? false,
        }));

        const template = await this.prisma.runTemplate.create(
            {
                data: {
                    name: dto.name,
                    fields: fieldsJson,
                },
            },
        );

        this.logger.log(
            `RunTemplate created: ${template.id}`,
        );
        return template;
    }

    async list() {
        return this.prisma.runTemplate.findMany();
    }

    async get(id: string) {
        const template =
            await this.prisma.runTemplate.findUnique({
                where: { id },
            });

        if (!template) {
            throw new BadRequestException(
                'RunTemplate not found',
            );
        }

        return template;
    }

    async update(
        id: string,
        dto: UpdateRunTemplateDto,
    ) {
        if (dto.name !== undefined && dto.name.trim() === '') {
            throw new BadRequestException('name cannot be empty');
        }
        if (dto.fields) {
            this.validator.validate(dto.fields);
        }

        const fieldsJson: RunTemplateFieldJson[] = dto.fields.map(f => ({
            key: f.key,
            type: f.type,
            required: f.required ?? false,
        }));

        return this.prisma.runTemplate.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.fields && { fields: fieldsJson }),
            },
        });

    }
}
