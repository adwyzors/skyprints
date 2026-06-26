import { BadRequestException } from '@nestjs/common';
import { RunFieldsValidator } from './run-fields.validator';

describe('RunFieldsValidator', () => {
  let validator: RunFieldsValidator;

  beforeEach(() => {
    validator = new RunFieldsValidator();
  });

  it('passes when all required fields are present with correct types', () => {
    expect(() =>
      validator.validate(
        [
          { key: 'quantity', type: 'number', required: true },
          { key: 'new_rate', type: 'number', required: true },
        ],
        { quantity: 100, new_rate: 50 },
      ),
    ).not.toThrow();
  });

  it('throws when a required field is missing', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', required: true }],
        {},
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', required: true }],
        {},
      ),
    ).toThrow("Field 'quantity' is required");
  });

  it('skips validation for optional missing fields', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', required: false }],
        {},
      ),
    ).not.toThrow();
  });

  it('throws when a number field receives a string value', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number' }],
        { quantity: '100' },
      ),
    ).toThrow("Field 'quantity' must be number");
  });

  it('throws when a string field receives a number value', () => {
    expect(() =>
      validator.validate(
        [{ key: 'label', type: 'string' }],
        { label: 42 },
      ),
    ).toThrow("Field 'label' must be string");
  });

  it('throws when a boolean field receives a non-boolean', () => {
    expect(() =>
      validator.validate(
        [{ key: 'isFusing', type: 'boolean' }],
        { isFusing: 1 },
      ),
    ).toThrow("Field 'isFusing' must be boolean");
  });

  it('throws when value is below min', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', min: 1 }],
        { quantity: 0 },
      ),
    ).toThrow("Field 'quantity' < min");
  });

  it('throws when value exceeds max', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', max: 1000 }],
        { quantity: 5000 },
      ),
    ).toThrow("Field 'quantity' > max");
  });

  it('passes when value is exactly at min and max bounds', () => {
    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', min: 1, max: 100 }],
        { quantity: 1 },
      ),
    ).not.toThrow();

    expect(() =>
      validator.validate(
        [{ key: 'quantity', type: 'number', min: 1, max: 100 }],
        { quantity: 100 },
      ),
    ).not.toThrow();
  });

  it('validates multiple fields and throws on the first failure', () => {
    expect(() =>
      validator.validate(
        [
          { key: 'quantity', type: 'number', required: true },
          { key: 'new_rate', type: 'number', required: true },
        ],
        { quantity: 100 }, // new_rate missing
      ),
    ).toThrow("Field 'new_rate' is required");
  });

  it('passes with empty template fields list', () => {
    expect(() => validator.validate([], { anything: 'value' })).not.toThrow();
  });

  describe('edge inputs that bypass current validation', () => {
    it('NaN passes the number type check (typeof NaN === "number") — known gap', () => {
      // NaN silently enters billing formula evaluation; guard should use Number.isFinite()
      expect(() =>
        validator.validate([{ key: 'quantity', type: 'number' }], { quantity: NaN }),
      ).not.toThrow();
    });

    it('Infinity passes when no max constraint is set — known gap', () => {
      expect(() =>
        validator.validate([{ key: 'quantity', type: 'number' }], { quantity: Infinity }),
      ).not.toThrow();
    });

    it('null for a required string field throws a type error, not a required-field error', () => {
      // null !== undefined so the required check passes; typeof null !== 'string' triggers type check
      expect(() =>
        validator.validate([{ key: 'label', type: 'string', required: true }], {
          label: null as any,
        }),
      ).toThrow("Field 'label' must be string");
    });
  });
});
