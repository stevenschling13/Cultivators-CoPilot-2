import { z } from 'zod';

const EnvSchema = z.object({
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_APP_VERSION: z.string().optional(),
  VITE_API_BASE_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

type RawEnv = Record<string, unknown> & { MODE?: string };

const FALLBACK_ENV: EnvConfig = {
  VITE_APP_ENV: 'development',
  VITE_APP_VERSION: undefined,
  VITE_API_BASE_URL: undefined,
};

function reportInvalidEnv(error: z.ZodError, mode: string) {
  const flattened = error.flatten();
  const details = {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };

  if (mode !== 'production') {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  console.error('Invalid environment configuration detected in production mode', details);
}

export function parseEnv(rawEnv: RawEnv, mode: string): EnvConfig {
  const result = EnvSchema.safeParse(rawEnv);

  if (result.success) {
    return result.data;
  }

  reportInvalidEnv(result.error, mode);
  return FALLBACK_ENV;
}

const runtimeEnv = (typeof import.meta !== 'undefined' && import.meta.env) || ({} as RawEnv);
const runtimeMode = runtimeEnv.MODE || (typeof process !== 'undefined' ? process.env.NODE_ENV : undefined) || 'production';

export const env = parseEnv(runtimeEnv, runtimeMode);
