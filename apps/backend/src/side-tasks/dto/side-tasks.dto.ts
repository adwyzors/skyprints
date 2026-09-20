import { SideTaskPriority } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSideTaskStageTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSideTaskStageTypeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateSideTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(SideTaskPriority)
  priority?: SideTaskPriority;

  @IsOptional()
  @IsString()
  requiredBy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Maximum 2 images allowed' })
  @IsString({ each: true })
  images?: string[];

  @IsUUID()
  @IsNotEmpty()
  initialStageTypeId: string;

  @IsUUID()
  @IsNotEmpty()
  initialAssigneeId: string;
}

export class UpdateSideTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(SideTaskPriority)
  priority?: SideTaskPriority;

  @IsOptional()
  @IsString()
  requiredBy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Maximum 2 images allowed' })
  @IsString({ each: true })
  images?: string[];
}

export class PassStageDto {
  @IsUUID()
  @IsNotEmpty()
  nextStageTypeId: string;

  @IsUUID()
  @IsNotEmpty()
  nextAssigneeId: string;

  @IsOptional()
  @IsString()
  completionNote?: string;
}

export class ReassignStageDto {
  @IsUUID()
  @IsNotEmpty()
  newAssigneeId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SubmitReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Completion note is required when submitting for review' })
  completionNote: string;
}

export class SendBackReviewDto {
  @IsString()
  @IsNotEmpty({ message: 'Reason is required when sending back a task' })
  reason: string;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;
}

export class AbandonSideTaskDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
