import { parse } from "mathjs";

export function extractFormulaVariables(
    formula: string
): Set<string> {
    const vars = new Set<string>();

    const ast = parse(formula);
    ast.traverse((node: any) => {
        if (node.isSymbolNode) {
            vars.add(node.name);
        }
    });

    return vars;
}
