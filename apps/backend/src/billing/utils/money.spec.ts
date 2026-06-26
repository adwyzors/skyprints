import Decimal from 'decimal.js';
import { toMoney } from './money';

describe('toMoney', () => {
  it('returns a Decimal with 4 decimal places', () => {
    const result = toMoney(100.12345678);
    expect(result).toBeInstanceOf(Decimal);
    expect(result.decimalPlaces()).toBeLessThanOrEqual(4);
  });

  it('rounds to 4 decimal places', () => {
    expect(toMoney(1.23456).toFixed(4)).toBe('1.2346');
  });

  it('handles zero', () => {
    expect(toMoney(0).toNumber()).toBe(0);
  });

  it('handles negative values', () => {
    expect(toMoney(-99.9999).toNumber()).toBe(-99.9999);
  });

  it('preserves integer values', () => {
    expect(toMoney(500).toNumber()).toBe(500);
  });

  it('avoids floating point drift on common amounts', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    const result = toMoney(0.1 + 0.2);
    expect(result.toFixed(4)).toBe('0.3000');
  });
});
