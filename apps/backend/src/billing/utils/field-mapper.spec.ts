import { extractNumericVariables, normalizeFieldKey } from './field-mapper';

describe('normalizeFieldKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeFieldKey('  New Rate  ')).toBe('new_rate');
  });

  it('replaces spaces and special chars with underscore', () => {
    expect(normalizeFieldKey('QC&COUNTING')).toBe('qc_counting');
  });

  it('collapses consecutive non-alphanum into a single underscore', () => {
    expect(normalizeFieldKey('Total  Amount!!!')).toBe('total_amount');
  });

  it('strips leading/trailing underscores', () => {
    expect(normalizeFieldKey('_foo_bar_')).toBe('foo_bar');
  });

  it('handles already-clean keys', () => {
    expect(normalizeFieldKey('new_rate')).toBe('new_rate');
  });
});

describe('extractNumericVariables', () => {
  it('extracts plain numbers', () => {
    expect(extractNumericVariables({ quantity: 100, new_rate: 50 })).toEqual({
      quantity: 100,
      new_rate: 50,
    });
  });

  it('parses numeric strings', () => {
    const result = extractNumericVariables({ 'New Rate': '45.5' });
    expect(result['new_rate']).toBe(45.5);
  });

  it('strips currency characters before parsing', () => {
    const result = extractNumericVariables({ Amount: '₹1,500.00' });
    expect(result['amount']).toBe(1500);
  });

  it('ignores non-numeric strings', () => {
    const result = extractNumericVariables({ label: 'Screen Printing' });
    expect(result).not.toHaveProperty('label');
  });

  it('ignores Infinity and NaN', () => {
    const result = extractNumericVariables({ a: Infinity, b: NaN });
    expect(result).toEqual({});
  });

  it('ignores null and undefined values', () => {
    const result = extractNumericVariables({ a: null as any, b: undefined as any });
    expect(result).toEqual({});
  });

  it('normalizes keys while extracting', () => {
    const result = extractNumericVariables({ 'Total Quantity': 200 });
    expect(result['total_quantity']).toBe(200);
  });

  it('ignores object/array values', () => {
    const result = extractNumericVariables({ items: [1, 2, 3] as any });
    expect(result).not.toHaveProperty('items');
  });
});
