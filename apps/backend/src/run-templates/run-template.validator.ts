import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class RunTemplateValidator {
  private readonly logger = new Logger(
    RunTemplateValidator.name,
  );

  validate(fields: Record<string, any>[]) {
    for (const field of fields) {
      if (!field.key || !field.type) {
        throw new BadRequestException(
          'Each field must have key and type',
        );
      }

      if (
        !['string', 'number', 'boolean'].includes(
          field.type,
        )
      ) {
        throw new BadRequestException(
          `Invalid type for field ${field.key}`,
        );
      }
    }

    this.logger.debug(
      'RunTemplate fields validated',
    );
  }
}
