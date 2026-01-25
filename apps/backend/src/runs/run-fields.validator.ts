import {
    BadRequestException,
    Injectable
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ContextLogger } from '../common/logger/context.logger';

interface TemplateField {
    key: string;
    type: 'string' | 'number' | 'boolean';
    required?: boolean;
    min?: number;
    max?: number;
}

@Injectable()
export class RunFieldsValidator {
    private readonly logger = new ContextLogger(RunFieldsValidator.name);

    validate(
        templateFields: TemplateField[],
        fields: Prisma.InputJsonValue,
    ) {
        for (const def of templateFields) {
            const value = fields[def.key];

            if (def.required && value === undefined) {
                throw new BadRequestException(
                    `Field '${def.key}' is required`,
                );
            }

            if (value === undefined) continue;

            switch (def.type) {
                case 'string':
                    if (typeof value !== 'string') {
                        throw new BadRequestException(
                            `Field '${def.key}' must be string`,
                        );
                    }
                    break;

                case 'number':
                    if (typeof value !== 'number') {
                        throw new BadRequestException(
                            `Field '${def.key}' must be number`,
                        );
                    }
                    if (
                        def.min !== undefined &&
                        value < def.min
                    ) {
                        throw new BadRequestException(
                            `Field '${def.key}' < min`,
                        );
                    }
                    if (
                        def.max !== undefined &&
                        value > def.max
                    ) {
                        throw new BadRequestException(
                            `Field '${def.key}' > max`,
                        );
                    }
                    break;

                case 'boolean':
                    if (typeof value !== 'boolean') {
                        throw new BadRequestException(
                            `Field '${def.key}' must be boolean`,
                        );
                    }
                    break;
            }
        }

        this.logger.debug('Run fields validated');
    }
}
