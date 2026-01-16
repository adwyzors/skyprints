import { Injectable } from "@nestjs/common";

@Injectable()
export class FormulaCompiler {
    private readonly cache = new Map<string, string>();

    compile(rawFormula: string): string {
        const cached = this.cache.get(rawFormula);
        if (cached !== undefined) {
            return cached;
        }

        const sanitized = rawFormula.replace(
            /[^a-zA-Z0-9_+\-*/(). ]/g,
            ""
        );

        this.cache.set(rawFormula, sanitized);
        return sanitized;
    }
}
