import pg from 'pg';
import type { Config } from '../config.js';
import type { Filters } from '../../shared/contracts.js';
import type { Catalog, MetricRow, Repository, Snapshot } from '../types.js';
import { serviceLabel, warehouseLabel } from '../identity.js';
import { businessDate, shiftMonth } from '../dates.js';

export interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}
interface RawRow extends Record<string, unknown> {
  id: string;
  shipment_id: string;
  container_no: string | null;
  service_name: string | null;
  carrier_name: string | null;
  channel_name: string | null;
  origin: string | null;
  destination: string | null;
  is_check: boolean;
  departure: string;
  arrival: string | null;
  pickup: string | null;
  devanned: string | null;
  delivered: string | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  total: number | null;
  sea: number | null;
  port: number | null;
  devanning: number | null;
  tail: number | null;
}
// Always use the vetted views AND enforce public access/tenant boundaries here.
const gate = `s.source_tenant = $1 AND s.is_published IS TRUE AND m.is_published IS TRUE
 AND s.record_status = 'active' AND s.transport_mode = 'sea'
 AND s.atd_date IS NOT NULL AND s.atd_date <= $2::date
 AND NOT freight.has_metric_issue(s.id, ARRAY['atd_date'])`;
const base = `FROM freight.valid_container_metrics m JOIN freight.shipments s ON s.id = m.id`;
const fields = `s.id::text AS shipment_id, s.container_no, s.service_name, s.carrier_name, s.channel_name,
 s.origin_port_name AS origin, s.destination_port_name AS destination, m.is_check,
 s.atd_date::text AS departure,
 CASE WHEN s.ata_date <= $2::date AND NOT freight.has_metric_issue(s.id, ARRAY['ata_date']) THEN s.ata_date::text END AS arrival,
 CASE WHEN s.picked_up_date <= $2::date AND NOT freight.has_metric_issue(s.id, ARRAY['picked_up_date']) THEN s.picked_up_date::text END AS pickup,
 CASE WHEN s.devanned_date <= $2::date AND NOT freight.has_metric_issue(s.id, ARRAY['devanned_date']) THEN s.devanned_date::text END AS devanned,
 CASE WHEN s.ata_date <= $2::date THEN m.sea_days END AS sea,
 CASE WHEN s.picked_up_date <= $2::date THEN m.arrival_to_pickup_days END AS port,
 CASE WHEN s.devanned_date <= $2::date THEN m.pickup_to_devanning_days END AS devanning`;
const warehouseJoin = ` JOIN freight.valid_amazon_delivery_metrics w ON w.shipment_id = s.id`;
const warehouseGate = ` AND w.is_published IS TRUE AND w.delivery_scope = 'amazon_warehouse'
 AND w.delivery_status = 'delivered' AND w.actual_delivery_date <= $2::date`;
function escapedLike(value: string) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}
function whereFilters(filters: Filters, fromMonth: string) {
  const values: unknown[] = [`${fromMonth}-01`, `${shiftMonth(filters.month, 1)}-01`];
  const terms = ['s.atd_date >= $3::date', 's.atd_date < $4::date'];
  for (const [key, column] of [
    ['origin', 's.origin_port_name'],
    ['destination', 's.destination_port_name'],
    ['channel', 's.channel_name'],
  ] as const) {
    if (filters[key] !== 'all') {
      values.push(filters[key]);
      terms.push(`${column} = $${values.length + 2}`);
    }
  }
  if (filters.inspection !== 'all') {
    values.push(filters.inspection === 'yes');
    terms.push(`m.is_check = $${values.length + 2}`);
  }
  if (filters.search) {
    values.push(escapedLike(filters.search));
    terms.push(`s.container_no ILIKE $${values.length + 2} ESCAPE '\\'`);
  }
  return { values, sql: terms.join(' AND ') };
}
function mapRow(r: RawRow): MetricRow {
  return {
    id: r.id,
    shipmentId: r.shipment_id,
    containerNo: r.container_no,
    route: serviceLabel(r.service_name, r.carrier_name),
    warehouse: warehouseLabel(r.warehouse_code, r.warehouse_name),
    origin: r.origin,
    destination: r.destination,
    channel: r.channel_name,
    inspected: r.is_check,
    departure: r.departure,
    arrival: r.arrival,
    pickup: r.pickup,
    devanned: r.devanned,
    delivered: r.delivered,
    total: r.total,
    sea: r.sea,
    port: r.port,
    devanning: r.devanning,
    tail: r.tail,
  };
}
function unique(values: (string | null)[]) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
}
export class DatasetTooLargeError extends Error {
  constructor() {
    super('Query result exceeds the supported sample limit');
  }
}
export class SqlReader {
  constructor(
    private db: Queryable,
    private tenant: string,
    private today: string,
    private rowLimit = 50000,
  ) {}
  async catalog(): Promise<Catalog> {
    const result = await this.db.query<RawRow>(
      `SELECT DISTINCT s.origin_port_name AS origin, s.destination_port_name AS destination,
      s.channel_name, s.service_name, s.carrier_name, to_char(s.atd_date, 'YYYY-MM') AS month ${base} WHERE ${gate}`,
      [this.tenant, this.today],
    );
    const warehouseResult = await this.db.query<RawRow>(
      `SELECT DISTINCT w.warehouse_code, w.warehouse_name ${base} ${warehouseJoin} WHERE ${gate} ${warehouseGate}`,
      [this.tenant, this.today],
    );
    const routes = result.rows.flatMap((r) => {
      const value = serviceLabel(r.service_name, r.carrier_name);
      return value ? [value] : [];
    });
    const warehouses = warehouseResult.rows.flatMap((r) => {
      const value = warehouseLabel(r.warehouse_code, r.warehouse_name);
      return value ? [value] : [];
    });
    return {
      months: unique(result.rows.map((r) => String(r.month))).reverse(),
      origins: unique(result.rows.map((r) => r.origin)),
      destinations: unique(result.rows.map((r) => r.destination)),
      channels: unique(result.rows.map((r) => r.channel_name)),
      routes: [...new Map(routes.map((r) => [r.id, r])).values()],
      warehouses: [...new Map(warehouses.map((w) => [w.id, w])).values()],
    };
  }
  async snapshot(filters: Filters, fromMonth: string): Promise<Snapshot> {
    const query = whereFilters(filters, fromMonth);
    const parameters = [this.tenant, this.today, ...query.values];
    const containers = await this.db.query<RawRow>(
      `SELECT s.id::text AS id, ${fields}, NULL::text AS warehouse_code,
      NULL::text AS warehouse_name, NULL::text AS delivered,
      CASE WHEN s.devanned_date <= $2::date THEN m.departure_to_devanning_days END AS total,
      CASE WHEN s.devanned_date <= $2::date AND s.devanned_date >= s.ata_date
        AND NOT freight.has_metric_issue(s.id, ARRAY['ata_date','devanned_date']) THEN s.devanned_date-s.ata_date END AS tail
      ${base} WHERE ${gate} AND ${query.sql} ORDER BY s.atd_date, s.id LIMIT ${this.rowLimit + 1}`,
      parameters,
    );
    const warehouses = await this.db.query<RawRow>(
      `SELECT w.id::text AS id, ${fields}, w.warehouse_code, w.warehouse_name,
      w.actual_delivery_date::text AS delivered, w.departure_to_amazon_delivery_days AS total,
      w.devanning_to_amazon_delivery_days AS tail
      ${base} ${warehouseJoin} WHERE ${gate} ${warehouseGate} AND ${query.sql}
      ORDER BY s.atd_date, w.id LIMIT ${this.rowLimit + 1}`,
      parameters,
    );
    if (containers.rows.length > this.rowLimit || warehouses.rows.length > this.rowLimit)
      throw new DatasetTooLargeError();
    return {
      containers: containers.rows.map(mapRow),
      warehouses: warehouses.rows.map(mapRow),
      catalog: await this.catalog(),
    };
  }
}
export class PostgresRepository implements Repository {
  readonly source = 'postgres' as const;
  private pool: pg.Pool;
  constructor(
    private config: Config,
    private clock = () => new Date(),
  ) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      ssl: config.DB_SSL === 'verify-full' ? { rejectUnauthorized: true } : false,
      application_name: 'freight-public-api',
    });
    // Idle connection failures must not terminate the process or print credentials.
    this.pool.on('error', () => {
      process.stderr.write('Database connection became unavailable\n');
    });
  }
  private async read<T>(operation: (reader: SqlReader) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result = await operation(
        new SqlReader(client, this.config.SOURCE_TENANT, businessDate(this.clock())),
      );
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  catalog() {
    return this.read((reader) => reader.catalog());
  }
  snapshot(filters: Filters, fromMonth: string) {
    return this.read((reader) => reader.snapshot(filters, fromMonth));
  }
  async ready() {
    await this.pool.query('SELECT id FROM freight.valid_container_metrics LIMIT 0');
    await this.pool.query('SELECT id FROM freight.valid_amazon_delivery_metrics LIMIT 0');
  }
  async close() {
    await this.pool.end();
  }
}
