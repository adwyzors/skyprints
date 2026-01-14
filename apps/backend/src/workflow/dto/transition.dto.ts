import { IsString, IsOptional, IsObject } from 'class-validator';

export class TransitionDto {
  @IsString()
  fromStatusCode: string;

  @IsString()
  toStatusCode: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
