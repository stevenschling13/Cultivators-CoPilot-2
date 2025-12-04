import { z } from 'zod';
import { errorService } from '../errorService';

export const DEFAULT_AI_RESPONSE_BYTE_LIMIT = 5 * 1024 * 1024; // 5 MB

/**
 * Safely parses a JSON string against a Zod schema.
 * If parsing fails, it logs to the Flight Recorder and throws a typed error.
 */
export function safeParseAIResponse<T>(
  jsonString: string | undefined,
  schema: z.ZodType<T>,
  context: string,
  options?: { maxBytes?: number }
): T {
  if (!jsonString) {
    const err = new Error(`AI Response Empty in context: ${context}`);
    errorService.captureError(err, { severity: 'MEDIUM', metadata: { context } });
    throw err;
  }

  // Sanitize Markdown code blocks if present (Gemini sometimes adds ```json ... ```)
  const sanitized = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  const maxBytes = options?.maxBytes ?? DEFAULT_AI_RESPONSE_BYTE_LIMIT;
  const payloadBytes = new TextEncoder().encode(sanitized).length;

  if (payloadBytes > maxBytes) {
    const err = new Error(`AI response too large in context: ${context}`);
    errorService.captureError(err, {
      severity: 'HIGH',
      metadata: { context, sizeBytes: payloadBytes, maxBytes }
    });
    throw err;
  }

  try {
    const json = JSON.parse(sanitized);
    const result = schema.safeParse(json);

    if (!result.success) {
      const err = new Error(`AI Schema Validation Failed: ${context}`);
      errorService.captureError(err, { 
        severity: 'HIGH', 
        metadata: { 
          context, 
          validationErrors: result.error.format(), 
          raw: jsonString 
        } 
      });
      // In a stricter system we might throw, but for AI we often want to attempt a partial recovery or let the UI handle the failure.
      // For now, we throw to ensure the UI knows data is bad.
      throw err;
    }
    return result.data;
  } catch (e) {
    if (e instanceof SyntaxError) {
       const err = new Error(`AI JSON Parse Failed: ${context}`);
       errorService.captureError(err, { severity: 'MEDIUM', metadata: { raw: jsonString } });
       throw err;
    }
    throw e;
  }
}
