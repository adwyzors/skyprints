import { IsObject } from "class-validator";

export class ConfigureRunDto {
@IsObject()
fields: Record<string, any>;
}