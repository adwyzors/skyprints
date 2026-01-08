import {
    Injectable,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RunTemplateValidator {
    private readonly logger = new Logger(RunTemplateValidator.name);

    constructor(private readonly prisma: PrismaService) { }

    async validateRunTemplates(
        selections: { runTemplateId: string }[],
    ): Promise<Map<string, any>> {
        const ids = selections.map((r) => r.runTemplateId);

        const templates = await this.prisma.runTemplate.findMany({
            where: {
                id: { in: ids },
                //isActive: true,
            },
        });

        if (templates.length !== ids.length) {
            this.logger.warn(
                `Invalid or inactive run template detected`,
            );
            throw new BadRequestException(
                'Invalid or inactive run template',
            );
        }

        const map = new Map<string, any>();
        templates.forEach((t) => map.set(t.id, t));

        return map;
    }
}
