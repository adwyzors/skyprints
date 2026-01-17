import { RunTemplateField } from '@app/contracts';
import { BadRequestException } from '@nestjs/common';
import { parse } from 'mathjs';

export function validateBillingFormula(
    formula: string,
    fields: RunTemplateField[],
) {
    const allowedVariables = new Set(
        fields
            .filter((f) => f.type === 'number')
            .map((f) => f.formulaKey!),
    );

    const ast = parse(formula);

    ast.traverse((node: any) => {
        if (node.isFunctionNode) {
            throw new BadRequestException(
                'Functions are not allowed in billing formula',
            );
        }

        if (node.isSymbolNode) {
            if (!allowedVariables.has(node.name)) {
                //throw new BadRequestException(
                //    `Invalid variable in formula: "${node.name}"`,
                //);
            }
        }
    });
}
