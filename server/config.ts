import { z } from 'zod';
export const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATA_SOURCE: z.enum(['demo', 'postgres']).default('postgres'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().url().optional(),
    SOURCE_TENANT: z.string().trim().min(1).max(100).default('szzhhq'),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    DB_SSL: z.enum(['disable', 'verify-full']).default('disable'),
    STATIC_DIR: z.string().optional(),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(120),
    TRUST_PROXY: z.enum(['none', 'loopback']).default('none'),
    ALLOW_PRODUCTION_DEMO: z.enum(['true', 'false']).default('false'),
  })
  .superRefine((config, ctx) => {
    if (config.DATA_SOURCE === 'postgres' && !config.DATABASE_URL)
      ctx.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required in postgres mode',
        path: ['DATABASE_URL'],
      });
    if (
      config.NODE_ENV === 'production' &&
      config.DATA_SOURCE === 'demo' &&
      config.ALLOW_PRODUCTION_DEMO !== 'true'
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Production demo requires explicit ALLOW_PRODUCTION_DEMO=true',
        path: ['DATA_SOURCE'],
      });
  });
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid server configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  return parsed.data;
}
