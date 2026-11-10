import type { EntityLabel, Filters, Metadata, Source } from '../shared/contracts.js';
export interface MetricRow {
  id: string;
  shipmentId: string;
  containerNo: string | null;
  route: EntityLabel | null;
  warehouse: EntityLabel | null;
  origin: string | null;
  destination: string | null;
  channel: string | null;
  inspected: boolean;
  departure: string;
  arrival: string | null;
  pickup: string | null;
  devanned: string | null;
  delivered: string | null;
  total: number | null;
  sea: number | null;
  port: number | null;
  devanning: number | null;
  tail: number | null;
}
export interface Catalog extends Omit<Metadata, 'defaultMonth' | 'source' | 'generatedAt'> {
  routes: EntityLabel[];
  warehouses: EntityLabel[];
}
export interface Snapshot {
  containers: MetricRow[];
  warehouses: MetricRow[];
  catalog: Catalog;
}
export interface Repository {
  source: Source;
  catalog(): Promise<Catalog>;
  snapshot(filters: Filters, fromMonth: string): Promise<Snapshot>;
  ready(): Promise<void>;
  close(): Promise<void>;
}
