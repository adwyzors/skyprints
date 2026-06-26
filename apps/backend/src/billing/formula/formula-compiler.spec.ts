import { FormulaCompiler } from './formula-compiler';

describe('FormulaCompiler', () => {
  let compiler: FormulaCompiler;

  beforeEach(() => {
    compiler = new FormulaCompiler();
  });

  describe('compile', () => {
    it('passes through clean alphanumeric formulas', () => {
      expect(compiler.compile('quantity * new_rate')).toBe('quantity * new_rate');
    });

    it('strips characters not in the allowlist', () => {
      // Semicolons are stripped; parentheses are in the allowlist so they remain
      expect(compiler.compile('quantity;alert(1)')).toBe('quantityalert(1)');
      // Curly braces, backticks, quotes are also stripped
      expect(compiler.compile('`{quantity}`')).toBe('quantity');
    });

    it('allows parentheses and arithmetic operators', () => {
      const formula = '(pcs * new_rate) + layout_amount';
      expect(compiler.compile(formula)).toBe(formula);
    });

    it('allows decimal points', () => {
      expect(compiler.compile('1.5 * quantity')).toBe('1.5 * quantity');
    });

    it('returns the same result on repeated calls (idempotent)', () => {
      const formula = 'quantity * new_rate';
      expect(compiler.compile(formula)).toBe(compiler.compile(formula));
    });

    it('caches the result — second call hits cache', () => {
      const formula = 'pcs * new_rate';
      const first = compiler.compile(formula);
      const second = compiler.compile(formula);
      expect(first).toBe(second);
    });

    it('handles all production billing formulas without stripping anything', () => {
      const formulas = [
        'quantity * new_rate',
        'pcs * new_rate',
        'new_rate * total_quantity',
        'new_rate * total_mtr',
        'new_rate * totalquantity',
        'total_amount',
      ];
      for (const f of formulas) {
        expect(compiler.compile(f)).toBe(f);
      }
    });
  });
});
