import { getEffectiveLocationId } from './runs.service';

// POST_PROD_STAGES = ['WAITING','CUTTING/WEEDING','CURING','FUSING','QC & COUNTING','COMPLETE','BILLED']

describe('getEffectiveLocationId', () => {
  const pre = 'pre-loc-id';
  const post = 'post-loc-id';
  const fallback = 'fallback-loc-id';

  describe('pre-production stages', () => {
    const PRE_STAGES = ['DESIGN', 'SIZE/COLOR', 'TRACING', 'EXPOSING', 'SAMPLE', 'PRODUCTION', 'RANGE'];

    it.each(PRE_STAGES)('returns preProductionLocationId for stage %s', (stage) => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: stage,
          preProductionLocationId: pre,
          postProductionLocationId: post,
          locationId: fallback,
        }),
      ).toBe(pre);
    });
  });

  describe('post-production stages', () => {
    const POST_STAGES = ['WAITING', 'CUTTING/WEEDING', 'CURING', 'FUSING', 'QC & COUNTING', 'COMPLETE', 'BILLED'];

    it.each(POST_STAGES)('returns postProductionLocationId for stage %s', (stage) => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: stage,
          preProductionLocationId: pre,
          postProductionLocationId: post,
          locationId: fallback,
        }),
      ).toBe(post);
    });
  });

  describe('fallback behaviour', () => {
    it('falls back to locationId if postProductionLocationId is null (post-prod stage)', () => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: 'COMPLETE',
          preProductionLocationId: null,
          postProductionLocationId: null,
          locationId: fallback,
        }),
      ).toBe(fallback);
    });

    it('falls back to locationId if preProductionLocationId is null (pre-prod stage)', () => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: 'DESIGN',
          preProductionLocationId: null,
          postProductionLocationId: null,
          locationId: fallback,
        }),
      ).toBe(fallback);
    });

    it('returns null when all location fields are null', () => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: 'DESIGN',
          preProductionLocationId: null,
          postProductionLocationId: null,
          locationId: null,
        }),
      ).toBeNull();
    });

    it('returns null when lifeCycleStatusCode is undefined and all locations null', () => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: undefined,
          preProductionLocationId: null,
          postProductionLocationId: null,
          locationId: null,
        }),
      ).toBeNull();
    });
  });

  describe('unknown stage', () => {
    it('treats unknown stages as pre-production and returns preProductionLocationId', () => {
      expect(
        getEffectiveLocationId({
          lifeCycleStatusCode: 'UNKNOWN_STAGE',
          preProductionLocationId: pre,
          postProductionLocationId: post,
          locationId: fallback,
        }),
      ).toBe(pre);
    });
  });
});
