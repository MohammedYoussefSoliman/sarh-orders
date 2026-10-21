import { z } from 'zod';

/**
 * Environment contract, validated once at boot.
 *
 * Fix #2 from the code review: the contractor build fell back to a hardcoded
 * JWT secret when the env var was missing, so a misconfigured deploy silently
 * signed tokens with a public string. Here a missing or too-short secret is a
 * startup failure instead.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters; generate with `openssl rand -base64 48`'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5180'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
}

/** Name of the httpOnly cookie carrying the session JWT. */
export const SESSION_COOKIE = 'sarh_session';
