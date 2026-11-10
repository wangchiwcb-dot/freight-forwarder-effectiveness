import { describe, expect, it } from 'vitest';
import { createDemoData } from '../data/demo';
import {
  daysBetween,
  defaultFilters,
  distribution,
  filterShipments,
  getEntities,
  getSamples,
  previousMonth,
  summarize,
} from './metrics';
import type { Dataset } from './types';

const now = new Date('2026-11-10T04:00:00Z');
const filters = defaultFilters(now);
const data: Dataset = {
  shipments: [
    {
      id: 'a',
      containerNo: 'DEMO1000001',
      routeId: 'clx',
      departure: '2026-10-01',
      arrival: '2026-10-13',
      pickup: '2026-10-15',
      devanning: '2026-10-16',
      inspected: false,
      published: true,
      active: true,
    },
    {
      id: 'b',
      containerNo: 'DEMO1000001',
      routeId: 'sea',
      departure: '2026-10-01',
      arrival: '2026-10-21',
      pickup: '2026-10-24',
      devanning: '2026-10-26',
      inspected: true,
      published: true,
      active: true,
    },
    {
      id: 'c',
      containerNo: 'DEMO1000002',
      routeId: 'sea',
      departure: '2026-10-28',
      arrival: null,
      pickup: null,
      devanning: null,
      inspected: false,
      published: true,
      active: true,
    },
  ],
  deliveries: [
    {
      id: 'd1',
      shipmentId: 'a',
      warehouseId: 'ONT8',
      actualDelivery: '2026-10-21',
      eligible: true,
    },
    {
      id: 'd2',
      shipmentId: 'a',
      warehouseId: 'LAX9',
      actualDelivery: '2026-10-23',
      eligible: true,
    },
    { id: 'd3', shipmentId: 'b', warehouseId: 'ONT8', actualDelivery: null, eligible: true },
  ],
};

describe('month and date contracts', () => {
  it('defaults to the previous calendar month including January rollover', () => {
    expect(previousMonth(now)).toBe('2026-10');
    expect(previousMonth(new Date('2027-01-05T12:00:00Z'))).toBe('2026-12');
  });
  it('counts calendar days across DST and rejects missing or reversed dates', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween(null, '2026-03-09')).toBeNull();
    expect(daysBetween('2026-03-09', '2026-03-07')).toBeNull();
    expect(daysBetween('2026-03-09', '2026-03-09')).toBe(0);
  });
});
describe('public timing sample boundaries', () => {
  it('counts distinct transports, not container numbers or delivery batches', () => {
    const containers = getSamples(data, filters, 'containers');
    expect(containers.map((s) => s.total)).toEqual([15, 25]);
    expect(getEntities(containers, 'containers')).toHaveLength(2);
    expect(summarize(containers).mean).toBe(20);
    const delivered = getSamples(data, filters, 'warehouses');
    expect(delivered.map((s) => s.total)).toEqual([20, 22]);
    expect(delivered.map((s) => s.tail)).toEqual([5, 7]);
  });
  it('filters publication, cancellation, inspection, ports, channel and container query', () => {
    expect(filterShipments(data, { ...filters, inspection: 'yes' }).map((s) => s.id)).toEqual([
      'b',
    ]);
    expect(
      filterShipments(data, {
        ...filters,
        origin: '宁波',
        channel: '美森限时达',
        destination: '长滩',
        search: 'demo1000001',
      }).map((s) => s.id),
    ).toEqual(['a']);
    const hidden = { ...data, shipments: data.shipments.map((s) => ({ ...s, published: false })) };
    expect(getSamples(hidden, filters, 'containers')).toHaveLength(0);
    const cancelled = { ...data, shipments: data.shipments.map((s) => ({ ...s, active: false })) };
    expect(getSamples(cancelled, filters, 'warehouses')).toHaveLength(0);
  });
  it('uses departure month even when completed in a later month', () => {
    const moved = {
      ...data,
      shipments: data.shipments.map((s) => ({ ...s, departure: '2026-09-30' })),
    };
    expect(getSamples(moved, filters, 'containers')).toHaveLength(0);
    expect(getSamples(moved, { ...filters, month: '2026-09' }, 'containers')).toHaveLength(2);
  });
  it('excludes incomplete, invalid chronology and ineligible deliveries', () => {
    const bad = {
      ...data,
      shipments: [{ ...data.shipments[0], devanning: '2026-09-30' }],
      deliveries: data.deliveries.map((d) => ({ ...d, eligible: false })),
    };
    expect(getSamples(bad, filters, 'containers')).toHaveLength(0);
    expect(getSamples(bad, filters, 'warehouses')).toHaveLength(0);
  });
  it('never fills missing results with a zero-day promise', () => {
    expect(summarize([])).toEqual({ count: 0, mean: null, p90: null, min: null, max: null });
  });
  it('calculates interpolated P90 and assigns boundary values to one histogram bin only', () => {
    const samples = getSamples(data, filters, 'containers');
    expect(summarize(samples).p90).toBe(24);
    const boundaries = [0, 10, 20, 50, 60].map((total, i) => ({
      ...samples[0],
      total,
      id: String(i),
    }));
    const bins = distribution(boundaries);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(5);
    expect(bins[0].count).toBe(1);
    expect(bins[1].count).toBe(1);
    expect(bins.at(-1)?.count).toBe(2);
  });
  it('never generates future milestones as completed facts', () => {
    const fixture = createDemoData(now);
    expect(fixture.shipments.length).toBeGreaterThan(1000);
    for (const s of fixture.shipments)
      for (const date of [s.arrival, s.pickup, s.devanning])
        if (date) expect(date <= '2026-11-10').toBe(true);
    for (const d of fixture.deliveries)
      if (d.actualDelivery) expect(d.actualDelivery <= '2026-11-10').toBe(true);
  });
});
