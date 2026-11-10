import { describe, expect, it } from 'vitest';
import { comparison, histogram, overview, summarize } from './analytics.js';
import { businessDate, daysBetween, monthAt, shiftMonth } from './dates.js';
import { serviceLabel, warehouseLabel } from './identity.js';
import { DemoRepository } from './repositories/demo.js';
import type { MetricRow, Snapshot } from './types.js';
import type { Filters } from '../shared/contracts.js';
const now = new Date('2026-11-10T04:00:00Z');
const filters: Filters = {
  month: '2026-10',
  origin: 'all',
  destination: 'all',
  channel: 'all',
  inspection: 'all',
  search: '',
};
const label = serviceLabel('CLX', '美森')!;
const row: MetricRow = {
  id: 'a',
  shipmentId: 'a',
  containerNo: 'DEMO1234567',
  route: label,
  warehouse: null,
  origin: '宁波',
  destination: '长滩',
  channel: '美森限时达',
  inspected: false,
  departure: '2026-10-01',
  arrival: '2026-10-13',
  pickup: null,
  devanned: '2026-10-16',
  delivered: null,
  total: 15,
  sea: 12,
  port: null,
  devanning: null,
  tail: 3,
};
function snapshot(containers: MetricRow[], warehouses: MetricRow[] = []): Snapshot {
  return {
    containers,
    warehouses,
    catalog: {
      months: ['2026-10'],
      origins: ['宁波'],
      destinations: ['长滩'],
      channels: ['美森限时达'],
      routes: [label],
      warehouses: [warehouseLabel('ONT8', null)!],
    },
  };
}

describe('calendar and statistics', () => {
  it('uses China calendar month and handles year rollover', () => {
    expect(monthAt(new Date('2026-12-31T16:01:00Z'))).toBe('2027-01');
    expect(businessDate(new Date('2026-12-31T16:01:00Z'))).toBe('2027-01-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
  it('uses natural days, permits zero and rejects missing or reversed endpoints', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-03-09', '2026-03-09')).toBe(0);
    expect(daysBetween('2026-03-09', '2026-03-08')).toBeNull();
    expect(daysBetween(null, '2026-03-09')).toBeNull();
  });
  it('calculates interpolated P90, not rounded nearest-rank', () => {
    expect(summarize([15, 25])).toEqual({ count: 2, mean: 20, p90: 24, min: 15, max: 25 });
    expect(summarize([]).mean).toBeNull();
  });
  it('counts histogram boundaries once and preserves outliers without huge payloads', () => {
    const bins = histogram([0, 10, 20, 50, 60], 'total');
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(5);
    expect(bins.at(-1)?.count).toBe(2);
    const outlier = histogram([1, 100000], 'total');
    expect(outlier.length).toBe(60);
    expect(outlier.at(-1)).toEqual({ name: '590+', count: 1 });
  });
});
describe('metric-specific denominators', () => {
  it('keeps valid total time even with missing intermediate milestones', () => {
    const result = comparison(snapshot([row]), filters, 'routes', 'total', undefined, 'demo', now);
    expect(result.overall.mean).toBe(15);
    expect(result.entities[0].summary.count).toBe(1);
    expect(result.entities[0].stages.count).toBe(0);
  });
  it('counts independent transports even when they reuse a container number', () => {
    const result = overview(
      snapshot([row, { ...row, id: 'b', shipmentId: 'b', total: 25 }]),
      filters,
      'demo',
      now,
      'mean',
    );
    expect(result.containers.count).toBe(2);
    expect(result.containers.mean).toBe(20);
  });
  it('counts warehouse batches independently without changing container averages', () => {
    const warehouse = warehouseLabel('ONT8', null)!;
    const input = snapshot(
      [row],
      [
        { ...row, id: 'd1', warehouse, total: 20, tail: 5 },
        { ...row, id: 'd2', warehouse, total: 22, tail: 7 },
      ],
    );
    const result = overview(input, filters, 'demo', now, 'mean');
    expect(result.containers.count).toBe(1);
    expect(result.warehouses.count).toBe(2);
    expect(result.warehouses.mean).toBe(21);
  });
  it('uses a common complete population for stacked stage means', () => {
    const complete = {
      ...row,
      id: 'b',
      shipmentId: 'b',
      total: 20,
      port: 5,
      devanning: 3,
      tail: 8,
    };
    const result = comparison(
      snapshot([row, complete]),
      filters,
      'routes',
      'total',
      undefined,
      'demo',
      now,
    );
    expect(result.entities[0].summary.count).toBe(2);
    expect(result.entities[0].stages).toEqual({
      count: 1,
      sea: 12,
      port: 5,
      devanning: 3,
      tail: null,
    });
  });
  it('never invents services for unclassified containers', () => {
    const result = overview(snapshot([{ ...row, route: null }]), filters, 'demo', now, 'mean');
    expect(result.containers.count).toBe(1);
    expect(result.routeCount).toBe(0);
    expect(result.unclassifiedRouteCount).toBe(1);
  });
  it('preserves selected public labels with null results and leaves missing trend months null', () => {
    const result = comparison(snapshot([]), filters, 'routes', 'total', [label.id], 'demo', now);
    expect(result.entities[0].name).toBe('美森 CLX');
    expect(result.entities[0].summary.mean).toBeNull();
    expect(result.trend.every((p) => p.values[label.id] === null)).toBe(true);
  });
  it('honors explicitly empty selection rather than restoring defaults', () => {
    expect(
      comparison(snapshot([row]), filters, 'routes', 'total', [], 'demo', now).entities,
    ).toEqual([]);
  });
  it('does not label incomplete transports as zero day timing', () => {
    const result = comparison(
      snapshot([{ ...row, total: null, tail: null }]),
      filters,
      'containers',
      'total',
      undefined,
      'demo',
      now,
    );
    expect(result.cohortCount).toBe(1);
    expect(result.overall.count).toBe(0);
    expect(result.overall.mean).toBeNull();
  });
  it('demo is deterministic and never completes future milestones', async () => {
    const repository = new DemoRepository(now);
    const result = await repository.snapshot(filters, '2026-05');
    expect(result.containers.length).toBeGreaterThan(500);
    for (const r of [...result.containers, ...result.warehouses])
      for (const date of [r.arrival, r.pickup, r.devanned, r.delivered])
        if (date) expect(date <= '2026-11-10').toBe(true);
  });
});
