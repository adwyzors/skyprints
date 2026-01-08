import {
  IsString,
  IsArray,
  ArrayMinSize,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class RunTemplateFieldDto {
  @IsString()
  key: string;

  @IsString()
  type: 'string' | 'number' | 'boolean' | 'date';

  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateRunTemplateDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  fields: RunTemplateFieldDto[];
}
