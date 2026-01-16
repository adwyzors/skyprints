import { RunTemplateField } from '@app/contracts';
import { BadRequestException } from '@nestjs/common';

export function toFormulaKey(key: string): string {
    return key
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * Adds formulaKey while preserving UI key
 * Rejects collisions after normalization
 */
export function attachFormulaKeys(
    fields: RunTemplateField[],
): RunTemplateField[] {
    const seen = new Map<string, string>();

    return fields.map((field) => {
        const formulaKey = toFormulaKey(field.key);

        if (seen.has(formulaKey)) {
            throw new BadRequestException(
                `Field "${field.key}" conflicts with "${seen.get(
                    formulaKey,
                )}" after normalization`,
            );
        }

        seen.set(formulaKey, field.key);

        return {
            ...field,
            formulaKey,
        };
    });
}
