import { Prisma } from '@prisma/client';
import { IsObject } from 'class-validator';

export class ConfigureRunDto {
  @IsObject()
  fields: Prisma.InputJsonValue;
}
