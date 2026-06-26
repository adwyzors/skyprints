import { checksumFormula } from './formula-checksum';

describe('checksumFormula', () => {
  it('returns a 64-character hex SHA-256 string', () => {
    const result = checksumFormula('quantity * new_rate');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    const a = checksumFormula('quantity * new_rate');
    const b = checksumFormula('quantity * new_rate');
    expect(a).toBe(b);
  });

  it('produces different digests for different formulas', () => {
    const a = checksumFormula('quantity * new_rate');
    const b = checksumFormula('pcs * new_rate');
    expect(a).not.toBe(b);
  });

  it('is case-sensitive', () => {
    const a = checksumFormula('Quantity * New_Rate');
    const b = checksumFormula('quantity * new_rate');
    expect(a).not.toBe(b);
  });

  it('handles the sentinel ORDER_AGGREGATE formula key', () => {
    const result = checksumFormula('ORDER_AGGREGATE');
    expect(result).toHaveLength(64);
  });
});
