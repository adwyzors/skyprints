import Decimal from "decimal.js";

export function toMoney(value: number): Decimal {
    return new Decimal(value).toDecimalPlaces(4);
}
