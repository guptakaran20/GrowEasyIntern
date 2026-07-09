import { z } from 'zod';

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required').optional(),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
}).refine(
  (data) => data.NODE_ENV === 'test' || (data.GEMINI_API_KEY && data.GEMINI_API_KEY.length > 0),
  { message: 'GEMINI_API_KEY is required', path: ['GEMINI_API_KEY'] },
);

export type Env = {
  GEMINI_API_KEY: string;
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  FRONTEND_URL: string;
};

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`Environment validation failed:\n${formatted}`);
    process.exit(1);
  }
  return result.data as Env;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
