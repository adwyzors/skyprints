import { MathOnlyFormulaEngine } from './math-only.formula.engine';

describe('MathOnlyFormulaEngine', () => {
  let engine: MathOnlyFormulaEngine;

  beforeEach(() => {
    engine = new MathOnlyFormulaEngine();
  });

  describe('evaluate', () => {
    it('evaluates a simple product', () => {
      expect(engine.evaluate('quantity * new_rate', { quantity: 100, new_rate: 50 })).toBe(5000);
    });

    it('evaluates a multi-variable formula (DTF: pcs * new_rate)', () => {
      expect(engine.evaluate('pcs * new_rate', { pcs: 200, new_rate: 12.5 })).toBe(2500);
    });

    it('evaluates sublimation formula (new_rate * total_mtr)', () => {
      expect(engine.evaluate('new_rate * total_mtr', { new_rate: 80, total_mtr: 30 })).toBe(2400);
    });

    it('returns a single variable as total_amount', () => {
      expect(engine.evaluate('total_amount', { total_amount: 3750 })).toBe(3750);
    });

    it('handles decimal rates correctly', () => {
      const result = engine.evaluate('quantity * new_rate', { quantity: 1000, new_rate: 4.75 });
      expect(result).toBeCloseTo(4750, 2);
    });

    it('handles zero quantity', () => {
      expect(engine.evaluate('quantity * new_rate', { quantity: 0, new_rate: 50 })).toBe(0);
    });

    it('handles zero rate', () => {
      expect(engine.evaluate('quantity * new_rate', { quantity: 100, new_rate: 0 })).toBe(0);
    });

    it('evaluates parenthesised expressions', () => {
      const result = engine.evaluate('(pcs * new_rate) + layout_amount', {
        pcs: 10,
        new_rate: 100,
        layout_amount: 500,
      });
      expect(result).toBe(1500);
    });

    it('throws when expression references an undefined variable', () => {
      // mathjs throws on unknown symbols when no scope entry exists
      expect(() => engine.evaluate('pcs * new_rate', { pcs: 100 })).toThrow();
    });
  });

  describe('edge cases', () => {
    it('returns Infinity for division by zero — does not throw (caller must guard before Decimal)', () => {
      // mathjs evaluates 10/0 as Infinity; passing Infinity into new Decimal() will throw downstream
      const result = engine.evaluate('quantity / pcs', { quantity: 10, pcs: 0 });
      expect(result).toBe(Infinity);
    });

    it('produces a negative result for a negative quantity', () => {
      expect(engine.evaluate('quantity * new_rate', { quantity: -5, new_rate: 50 })).toBe(-250);
    });

    it('does not throw for an empty expression string — returns undefined (caller must validate)', () => {
      // mathjs evaluate('') silently returns undefined rather than throwing
      const result = engine.evaluate('', {});
      expect(result).toBeUndefined();
    });

    it('returns a boolean when the expression is a comparison (caller must reject non-numeric results)', () => {
      // mathjs allows comparison expressions; billing callers should validate the result type
      const result = engine.evaluate('qty > 0', { qty: 5 });
      expect(result).toBe(true);
    });
  });
});
