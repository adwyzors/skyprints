import { getFiscalYear } from './fiscal-year.utils';

describe('getFiscalYear', () => {
  it('returns YY-YY format', () => {
    const fy = getFiscalYear(new Date('2026-06-26'));
    expect(fy).toMatch(/^\d{2}-\d{2}$/);
  });

  it('April → start of new fiscal year', () => {
    expect(getFiscalYear(new Date('2026-04-01'))).toBe('26-27');
  });

  it('March → still in the previous fiscal year', () => {
    expect(getFiscalYear(new Date('2026-03-31'))).toBe('25-26');
  });

  it('June is in the same FY as April', () => {
    expect(getFiscalYear(new Date('2025-06-15'))).toBe('25-26');
  });

  it('January is in the FY that started the previous April', () => {
    expect(getFiscalYear(new Date('2026-01-10'))).toBe('25-26');
  });

  it('uses current date when no argument passed', () => {
    const result = getFiscalYear();
    expect(result).toMatch(/^\d{2}-\d{2}$/);
  });

  it('FY boundary: 31 March → ends at 25-26', () => {
    expect(getFiscalYear(new Date('2025-03-31'))).toBe('24-25');
  });

  it('FY boundary: 1 April → starts at 25-26', () => {
    expect(getFiscalYear(new Date('2025-04-01'))).toBe('25-26');
  });
});
