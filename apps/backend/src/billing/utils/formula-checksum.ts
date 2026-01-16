import crypto from "crypto";

export function checksumFormula(formula: string): string {
    return crypto
        .createHash("sha256")
        .update(formula)
        .digest("hex");
}
