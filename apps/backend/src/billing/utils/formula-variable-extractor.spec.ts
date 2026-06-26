import { extractFormulaVariables } from './formula-variable-extractor';

describe('extractFormulaVariables', () => {
  it('extracts variables from a simple product formula', () => {
    const vars = extractFormulaVariables('quantity * new_rate');
    expect(vars).toContain('quantity');
    expect(vars).toContain('new_rate');
    expect(vars.size).toBe(2);
  });

  it('extracts all variables from a complex DTF formula', () => {
    const vars = extractFormulaVariables('pcs * new_rate');
    expect(vars).toContain('pcs');
    expect(vars).toContain('new_rate');
  });

  it('extracts variables with underscores', () => {
    const vars = extractFormulaVariables('new_rate * total_mtr');
    expect(vars).toContain('new_rate');
    expect(vars).toContain('total_mtr');
  });

  it('returns empty set for a formula with only literals', () => {
    const vars = extractFormulaVariables('100 * 50');
    expect(vars.size).toBe(0);
  });

  it('deduplicates repeated variable names', () => {
    const vars = extractFormulaVariables('quantity * quantity');
    expect(vars.size).toBe(1);
    expect(vars).toContain('quantity');
  });

  it('handles parenthesised expressions', () => {
    const vars = extractFormulaVariables('(pcs * new_rate) + layout_amount');
    expect(vars).toContain('pcs');
    expect(vars).toContain('new_rate');
    expect(vars).toContain('layout_amount');
  });

  it('returns an empty set for an empty formula string (mathjs parse does not throw)', () => {
    // mathjs parse('') returns an empty BlockNode — no symbol nodes are traversed
    const vars = extractFormulaVariables('');
    expect(vars.size).toBe(0);
  });
});
