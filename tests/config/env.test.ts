import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../config/env';

describe('environment configuration', () => {
  it('parses valid configuration values', () => {
    const env = parseEnv(
      {
        VITE_APP_ENV: 'staging',
        VITE_APP_VERSION: '1.2.3',
        VITE_API_BASE_URL: 'https://api.example.com',
      },
      'development'
    );

    expect(env.VITE_APP_ENV).toBe('staging');
    expect(env.VITE_APP_VERSION).toBe('1.2.3');
    expect(env.VITE_API_BASE_URL).toBe('https://api.example.com');
  });

  it('throws in non-production modes when validation fails', () => {
    expect(() =>
      parseEnv(
        {
          VITE_APP_ENV: 'invalid',
          VITE_API_BASE_URL: 'notaurl',
        },
        'development'
      )
    ).toThrow(/Invalid environment configuration/);
  });

  it('falls back safely in production when validation fails', () => {
    const env = parseEnv(
      {
        VITE_APP_ENV: 'invalid',
        VITE_API_BASE_URL: 'notaurl',
      },
      'production'
    );

    expect(env.VITE_APP_ENV).toBe('development');
    expect(env.VITE_API_BASE_URL).toBeUndefined();
  });
});
