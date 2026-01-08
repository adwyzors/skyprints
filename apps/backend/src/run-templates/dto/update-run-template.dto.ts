import { ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';
import { RunTemplateFieldDto } from './create-run-template.dto';

export class UpdateRunTemplateDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsArray()
    @ArrayMinSize(1)
    fields: RunTemplateFieldDto[];
}
