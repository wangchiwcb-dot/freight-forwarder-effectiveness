import { z } from 'zod';
import { dimensions, type Filters } from '../shared/contracts.js';
import { monthAt, shiftMonth } from './dates.js';
const text = z.string().trim().max(160);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const dimensionSchema = z.enum(dimensions);
export function queries(now: Date) {
  const current = monthAt(now);
  const base = z.object({
    month: z
      .string()
      .regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/)
      .refine((value) => value <= current, 'Month must not be in the future')
      .default(shiftMonth(current, -1)),
    origin: text.default('all'),
    destination: text.default('all'),
    channel: text.default('all'),
    inspection: z.enum(['all', 'yes', 'no']).default('all'),
    search: z.string().trim().max(80).default(''),
  });
  return {
    overview: base.extend({ statistic: z.enum(['mean', 'p90']).default('mean') }).strict(),
    comparison: base
      .extend({
        metric: z.enum(['total', 'sea', 'tail']).default('total'),
        ids: z
          .string()
          .max(410)
          .transform((value) => (value === '' ? [] : value.split(',')))
          .pipe(
            z
              .array(identifier)
              .max(4)
              .refine((ids) => new Set(ids).size === ids.length, 'Duplicate IDs'),
          )
          .optional(),
      })
      .strict(),
    entities: base
      .extend({
        metric: z.enum(['total', 'sea', 'tail']).default('total'),
        q: text.default(''),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(20),
      })
      .strict(),
  };
}
export function filtersOnly(input: Filters): Filters {
  const { month, origin, destination, channel, inspection, search } = input;
  return { month, origin, destination, channel, inspection, search };
}
