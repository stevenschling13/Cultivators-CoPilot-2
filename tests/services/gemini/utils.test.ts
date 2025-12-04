import { describe, expect, it, vi, beforeEach } from 'vitest';
import { z } from 'zod';

vi.mock('../../../services/errorService', () => {
  return {
    errorService: {
      captureError: vi.fn()
    }
  };
});

import { safeParseAIResponse } from '../../../services/gemini/utils';
import { errorService } from '../../../services/errorService';

const schema = z.object({ foo: z.string() });

describe('safeParseAIResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws and reports when sanitized payload exceeds byte limit', () => {
    const oversizedResponse = '```json {"foo":"' + 'a'.repeat(50) + '"}```';

    expect(() => safeParseAIResponse(oversizedResponse, schema, 'oversize-test', { maxBytes: 10 })).toThrow(
      /too large/
    );

    expect(errorService.captureError).toHaveBeenCalledTimes(1);
    expect(errorService.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        severity: 'HIGH',
        metadata: expect.objectContaining({
          context: 'oversize-test',
          maxBytes: 10,
          sizeBytes: expect.any(Number)
        })
      })
    );
  });
});
