import { Prisma } from '@prisma/client';
import {
  IsUUID,
  IsOptional,
  IsObject,
} from 'class-validator';

export class CreateRunDto {
  @IsUUID()
  runTemplateId: string;

  @IsOptional()
  @IsObject()
  fields?: Prisma.InputJsonValue;
}
