import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  LLM_PROVIDER: z.enum(['openai', 'anthropic']).default('anthropic'),
  LLM_MODEL: z.string().default('claude-3-5-sonnet-latest'),
});

export const env = envSchema.parse(process.env);
