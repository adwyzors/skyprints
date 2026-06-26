import { BadRequestException } from '@nestjs/common';
import { evalCondition } from './eval-condition';

describe('evalCondition', () => {
  describe('valid boolean conditions', () => {
    it('returns true when the condition is satisfied', () => {
      expect(evalCondition('qty > 0', { qty: 10 })).toBe(true);
    });

    it('returns false when the condition is not satisfied', () => {
      expect(evalCondition('qty > 0', { qty: 0 })).toBe(false);
    });

    it('evaluates a multi-variable boolean condition', () => {
      expect(evalCondition('qty > 0 and rate > 0', { qty: 5, rate: 10 })).toBe(true);
    });

    it('evaluates equality condition', () => {
      expect(evalCondition('status == 1', { status: 1 })).toBe(true);
    });
  });

  describe('invalid conditions', () => {
    it('throws BadRequestException when expression evaluates to a non-boolean (number)', () => {
      // qty + 1 = 6 — not boolean; inner throw is caught by the outer catch and re-thrown
      expect(() => evalCondition('qty + 1', { qty: 5 })).toThrow(BadRequestException);
    });

    it('throws "Invalid transition condition" for a non-boolean result', () => {
      expect(() => evalCondition('qty + 1', { qty: 5 })).toThrow('Invalid transition condition');
    });

    it('throws BadRequestException for syntactically invalid expression', () => {
      expect(() => evalCondition('qty >>>', { qty: 5 })).toThrow(BadRequestException);
    });

    it('throws BadRequestException when a referenced variable is not in context', () => {
      // mathjs throws for unknown symbols — caught and re-thrown
      expect(() => evalCondition('missing_var > 0', {})).toThrow(BadRequestException);
    });
  });
});
