import dayjs from 'dayjs';
import { routes, warehouses } from '../data/demo';
import type {
  Dataset,
  Dimension,
  Entity,
  Filters,
  Metric,
  Sample,
  Shipment,
  Summary,
} from './types';

export function previousMonth(now = new Date()): string {
  return dayjs(now).subtract(1, 'month').format('YYYY-MM');
}
export function defaultFilters(now = new Date()): Filters {
  return {
    month: previousMonth(now),
    origin: 'all',
    destination: 'all',
    channel: 'all',
    inspection: 'all',
    search: '',
  };
}
export function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  return Number.isFinite(days) && days >= 0 ? days : null;
}
export function filterShipments(data: Dataset, filters: Filters): Shipment[] {
  return data.shipments.filter((s) => {
    const route = routes.find((r) => r.id === s.routeId);
    return (
      s.active &&
      s.published &&
      route &&
      s.departure.startsWith(filters.month) &&
      (filters.origin === 'all' || route.origin === filters.origin) &&
      (filters.destination === 'all' || route.destination === filters.destination) &&
      (filters.channel === 'all' || route.channel === filters.channel) &&
      (filters.inspection === 'all' || s.inspected === (filters.inspection === 'yes')) &&
      (!filters.search || s.containerNo.toLowerCase().includes(filters.search.trim().toLowerCase()))
    );
  });
}
export function getSamples(data: Dataset, filters: Filters, dimension: Dimension): Sample[] {
  const shipments = filterShipments(data, filters);
  const byId = new Map(shipments.map((s) => [s.id, s]));
  const sample = (s: Shipment): Sample | null => {
    const total = daysBetween(s.departure, s.devanning);
    const sea = daysBetween(s.departure, s.arrival);
    const port = daysBetween(s.arrival, s.pickup);
    const devanning = daysBetween(s.pickup, s.devanning);
    if (total === null || sea === null || port === null || devanning === null) return null;
    return {
      id: s.id,
      label: s.containerNo,
      shipment: s,
      total,
      sea,
      port,
      devanning,
      tail: port + devanning,
    };
  };
  if (dimension !== 'warehouses')
    return shipments.map(sample).filter((s): s is Sample => s !== null);
  return data.deliveries.flatMap((d) => {
    const s = byId.get(d.shipmentId);
    if (!s || !d.eligible) return [];
    const base = sample(s);
    const total = daysBetween(s.departure, d.actualDelivery);
    const tail = daysBetween(s.devanning, d.actualDelivery);
    if (!base || total === null || tail === null) return [];
    return [{ ...base, id: d.id, label: d.warehouseId, warehouseId: d.warehouseId, total, tail }];
  });
}
export function summarize(samples: Sample[], metric: Metric = 'total'): Summary {
  const values = samples.map((s) => s[metric]).sort((a, b) => a - b);
  if (!values.length) return { count: 0, mean: null, p90: null, min: null, max: null };
  const position = (values.length - 1) * 0.9;
  const left = Math.floor(position);
  const p90 = values[left] + (values[Math.ceil(position)] - values[left]) * (position - left);
  return {
    count: values.length,
    mean: values.reduce((sum, v) => sum + v, 0) / values.length,
    p90,
    min: values[0],
    max: values.at(-1)!,
  };
}
export function getEntities(samples: Sample[], dimension: Dimension): Entity[] {
  const keys = [
    ...new Set(
      samples.map((s) =>
        dimension === 'warehouses'
          ? s.warehouseId!
          : dimension === 'routes'
            ? s.shipment.routeId
            : s.shipment.id,
      ),
    ),
  ];
  return keys.map((id) => {
    const group = samples.filter(
      (s) =>
        (dimension === 'warehouses'
          ? s.warehouseId
          : dimension === 'routes'
            ? s.shipment.routeId
            : s.shipment.id) === id,
    );
    const route = routes.find((r) => r.id === group[0].shipment.routeId)!;
    const warehouse = warehouses.find((w) => w.id === id);
    return {
      id,
      name:
        dimension === 'warehouses'
          ? id
          : dimension === 'routes'
            ? route.name
            : group[0].shipment.containerNo,
      subtitle:
        dimension === 'warehouses'
          ? (warehouse?.city ?? '')
          : dimension === 'routes'
            ? `${route.origin} → ${route.destination} · ${route.channel}`
            : `${route.name} · ${group[0].shipment.departure} 开船`,
      samples: group,
    };
  });
}
export function recentMonths(month: string, count = 6): string[] {
  return Array.from({ length: count }, (_, i) =>
    dayjs(`${month}-01`)
      .subtract(count - i - 1, 'month')
      .format('YYYY-MM'),
  );
}
export function distribution(samples: Sample[], metric: Metric = 'total') {
  const step = metric === 'total' ? 10 : 5;
  const max = Math.max(step * 5, ...samples.map((s) => s[metric]));
  const buckets = Math.ceil(max / step);
  return Array.from({ length: buckets }, (_, i) => ({
    name: `${i * step}–${(i + 1) * step}`,
    count: samples.filter(
      (s) =>
        s[metric] >= i * step &&
        (i === buckets - 1 ? s[metric] <= (i + 1) * step : s[metric] < (i + 1) * step),
    ).length,
  }));
}
export const formatDays = (n: number | null) => (n === null ? '—' : n.toFixed(1));
