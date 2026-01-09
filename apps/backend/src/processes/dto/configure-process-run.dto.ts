import { IsObject } from 'class-validator';

export class ConfigureProcessRunDto {
    @IsObject()
    fields: Record<string, any>;
}
