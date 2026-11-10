import type { Filters } from '../../shared/contracts.js';
import type { Catalog, MetricRow, Repository } from '../types.js';
import { createDemoData, routes, warehouses } from '../fixtures.js';
import { daysBetween } from '../dates.js';
import { serviceLabel, warehouseLabel } from '../identity.js';
export class DemoRepository implements Repository {
  readonly source = 'demo' as const;
  private containers: MetricRow[];
  private deliveries: MetricRow[];
  constructor(now = new Date()) {
    const fixture = createDemoData(now);
    this.containers = fixture.shipments
      .filter((s) => s.published && s.active)
      .map((s) => {
        const route = routes.find((r) => r.id === s.routeId)!;
        return {
          id: s.id,
          shipmentId: s.id,
          containerNo: s.containerNo,
          route: serviceLabel(route.name, route.carrier),
          warehouse: null,
          origin: route.origin,
          destination: route.destination,
          channel: route.channel,
          inspected: s.inspected,
          departure: s.departure,
          arrival: s.arrival,
          pickup: s.pickup,
          devanned: s.devanning,
          delivered: null,
          total: daysBetween(s.departure, s.devanning),
          sea: daysBetween(s.departure, s.arrival),
          port: daysBetween(s.arrival, s.pickup),
          devanning: daysBetween(s.pickup, s.devanning),
          tail: daysBetween(s.arrival, s.devanning),
        };
      });
    const byId = new Map(this.containers.map((c) => [c.id, c]));
    this.deliveries = fixture.deliveries.flatMap((d) => {
      const row = byId.get(d.shipmentId);
      if (!row || !d.eligible || !d.actualDelivery) return [];
      const warehouse = warehouses.find((w) => w.id === d.warehouseId)!;
      return [
        {
          ...row,
          id: d.id,
          warehouse: warehouseLabel(warehouse.id, warehouse.city),
          delivered: d.actualDelivery,
          total: daysBetween(row.departure, d.actualDelivery),
          tail: daysBetween(row.devanned, d.actualDelivery),
        },
      ];
    });
  }
  async catalog(): Promise<Catalog> {
    const unique = (values: (string | null)[]) =>
      [...new Set(values.filter((s): s is string => !!s))].sort();
    return {
      months: unique(this.containers.map((c) => c.departure.slice(0, 7))).reverse(),
      origins: unique(this.containers.map((c) => c.origin)),
      destinations: unique(this.containers.map((c) => c.destination)),
      channels: unique(this.containers.map((c) => c.channel)),
      routes: [
        ...new Map(
          this.containers.flatMap((c) => (c.route ? [[c.route.id, c.route] as const] : [])),
        ).values(),
      ],
      warehouses: [
        ...new Map(
          this.deliveries.flatMap((c) =>
            c.warehouse ? [[c.warehouse.id, c.warehouse] as const] : [],
          ),
        ).values(),
      ],
    };
  }
  async snapshot(filters: Filters, fromMonth: string) {
    const accepts = (r: MetricRow) =>
      r.departure.slice(0, 7) >= fromMonth &&
      r.departure.slice(0, 7) <= filters.month &&
      (filters.origin === 'all' || r.origin === filters.origin) &&
      (filters.destination === 'all' || r.destination === filters.destination) &&
      (filters.channel === 'all' || r.channel === filters.channel) &&
      (filters.inspection === 'all' || r.inspected === (filters.inspection === 'yes')) &&
      (!filters.search || r.containerNo?.toLowerCase().includes(filters.search.toLowerCase()));
    return {
      containers: this.containers.filter(accepts),
      warehouses: this.deliveries.filter(accepts),
      catalog: await this.catalog(),
    };
  }
  async ready() {}
  async close() {}
}
