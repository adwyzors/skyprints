import { Injectable } from "@nestjs/common";
import { BillingFormulaEngine } from "../formula.engine";
import {evaluate} from "mathjs";

@Injectable()
export class MathOnlyFormulaEngine implements BillingFormulaEngine {
evaluate(expr, vars) {
return evaluate(expr, vars);
}
}