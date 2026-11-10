import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { DatasetTooLargeError, SqlReader, type Queryable } from './postgres.js';
import { comparison, overview } from '../analytics.js';
import type { Filters } from '../../shared/contracts.js';
const now = new Date('2026-11-10T04:00:00Z');
const filters: Filters = {
  month: '2026-10',
  origin: 'all',
  destination: 'all',
  channel: 'all',
  inspection: 'all',
  search: '',
};
let db: PGlite;
let reader: SqlReader;
const ids: Record<string, string> = {};
async function shipment(name: string, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  ids[name] = id;
  const input: Record<string, unknown> = {
    id,
    source_system: 'fixture',
    source_tenant: 'szzhhq',
    source_waybill_id: name,
    container_no: 'DEMO1234567',
    transport_mode: 'sea',
    service_name: 'CLX',
    carrier_name: '美森',
    channel_name: '美森限时达',
    origin_port_name: '宁波',
    destination_port_name: '长滩',
    record_status: 'active',
    atd_date: '2026-10-01',
    ata_date: '2026-10-13',
    picked_up_date: '2026-10-15',
    devanned_date: '2026-10-16',
    is_valid_data: true,
    is_published: true,
    published_by: 'test',
    published_at: now.toISOString(),
    ...overrides,
  };
  const keys = Object.keys(input);
  await db.query(
    `INSERT INTO freight.shipments (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(input),
  );
  return id;
}
async function delivery(shipmentId: string, overrides: Record<string, unknown> = {}) {
  const id = randomUUID();
  const input: Record<string, unknown> = {
    id,
    shipment_id: shipmentId,
    delivery_key: id,
    warehouse_code: 'ONT8',
    warehouse_name: 'ONT8',
    destination_type: 'amazon',
    delivery_method: 'truck',
    delivery_scope: 'amazon_warehouse',
    amazon_timing_eligible: true,
    completion_class: 'delivered',
    delivery_status: 'delivered',
    actual_delivery_date: '2026-10-21',
    is_valid_data: true,
    ...overrides,
  };
  const keys = Object.keys(input);
  await db.query(
    `INSERT INTO freight.deliveries (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
    Object.values(input),
  );
  return id;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec('CREATE ROLE freight_app;');
  const files = [
    'schema.sql',
    ...(await readdir('database')).filter((f) => /^00\d_.*\.sql$/.test(f)).sort(),
  ];
  for (const file of files) await db.exec(await readFile(`database/${file}`, 'utf8'));
  await db.exec(
    'GRANT USAGE ON SCHEMA freight TO freight_app; GRANT SELECT ON ALL TABLES IN SCHEMA freight TO freight_app;',
  );
  reader = new SqlReader(db as unknown as Queryable, 'szzhhq', '2026-11-10');
  await shipment('complete');
  await shipment('missing-middle', {
    picked_up_date: null,
    devanned_date: '2026-10-26',
    inspection_assessment: 'inspected',
  });
  await shipment('incomplete', { ata_date: null, picked_up_date: null, devanned_date: null });
  await shipment('private', {
    is_published: false,
    service_name: 'PRIVATE-SERVICE',
    origin_port_name: 'PRIVATE-PORT',
  });
  await shipment('other-tenant', { source_tenant: 'another', service_name: 'OTHER-TENANT' });
  await shipment('invalid', { is_valid_data: false });
  await shipment('cancelled', { record_status: 'cancelled' });
  await shipment('rail', { transport_mode: 'rail' });
  await shipment('bad-sea', { invalid_fields: ['ata_date'] });
  await shipment('unknown-service', { service_name: null });
  await shipment('future-completion', { devanned_date: '2026-11-20' });
  await shipment('literal-search', { container_no: 'PERCENT%_VALUE' });
  await shipment('previous-month', { atd_date: '2026-09-30' });
  await shipment('bad-departure', { invalid_fields: ['atd_date'] });
  await delivery(ids.complete);
  await delivery(ids.complete, { actual_delivery_date: '2026-10-23', warehouse_code: 'LAX9' });
  await delivery(ids['missing-middle'], { actual_delivery_date: '2026-10-30' });
  await delivery(ids.private, { warehouse_code: 'PRIVATE-WAREHOUSE' });
  await delivery(ids['other-tenant'], { warehouse_code: 'OTHER-TENANT-WH' });
  await delivery(ids.complete, { is_valid_data: false });
  await delivery(ids.complete, { is_aggregate: true });
  await delivery(ids.complete, { delivery_scope: 'courier', warehouse_code: 'COURIER' });
  await delivery(ids.complete, { invalid_fields: ['actual_delivery_date'] });
  await delivery(ids.complete, { actual_delivery_date: '2026-11-20', warehouse_code: 'FUTURE-WH' });
  await db.exec(await readFile('database/public_api_role.sql', 'utf8'));
  await db.exec('SET ROLE freight_public_api;');
});
afterAll(async () => {
  await db?.close();
});

describe('actual PostgreSQL schema and queries', () => {
  it('runs as the restricted API role without write access or internal-note access', async () => {
    expect((await db.query('SELECT current_user AS name')).rows).toEqual([
      { name: 'freight_public_api' },
    ]);
    await expect(db.query('SELECT notes_internal FROM freight.shipments')).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query("UPDATE freight.shipments SET container_no='tamper' WHERE false"),
    ).rejects.toThrow(/permission denied|read-only/);
  });
  it('enforces published tenant, sea mode, valid data, active state and usable departure', async () => {
    const result = await reader.snapshot(filters, filters.month);
    const selected = result.containers.map((r) => r.id);
    for (const name of [
      'private',
      'other-tenant',
      'invalid',
      'cancelled',
      'rail',
      'bad-departure',
      'previous-month',
    ])
      expect(selected).not.toContain(ids[name]);
    for (const name of [
      'complete',
      'missing-middle',
      'incomplete',
      'bad-sea',
      'unknown-service',
      'future-completion',
      'literal-search',
    ])
      expect(selected).toContain(ids[name]);
    expect(result.containers).toHaveLength(7);
  });
  it('excludes private metadata and invalid warehouse scopes', async () => {
    const catalog = await reader.catalog();
    expect(JSON.stringify(catalog)).not.toMatch(/PRIVATE|OTHER-TENANT|COURIER|FUTURE-WH/);
    const result = await reader.snapshot(filters, filters.month);
    expect(result.warehouses).toHaveLength(3);
    expect(result.warehouses.map((r) => r.total).sort((a, b) => a! - b!)).toEqual([20, 22, 29]);
  });
  it('honors per-field validation without dropping valid total timing', async () => {
    const result = await reader.snapshot(filters, filters.month);
    const missing = result.containers.find((r) => r.id === ids['missing-middle'])!;
    expect(missing.total).toBe(25);
    expect(missing.port).toBeNull();
    expect(missing.devanning).toBeNull();
    expect(missing.tail).toBe(13);
    const badSea = result.containers.find((r) => r.id === ids['bad-sea'])!;
    expect(badSea.total).toBe(15);
    expect(badSea.sea).toBeNull();
    expect(badSea.arrival).toBeNull();
    expect(badSea.tail).toBeNull();
    expect(result.containers.find((r) => r.id === ids['incomplete'])!.total).toBeNull();
    expect(result.containers.find((r) => r.id === ids['future-completion'])!.total).toBeNull();
  });
  it('uses parameters for all supplied text and treats wildcard characters literally', async () => {
    expect(
      (await reader.snapshot({ ...filters, origin: "宁波' OR true --" }, filters.month)).containers,
    ).toEqual([]);
    expect(
      (await reader.snapshot({ ...filters, search: '%_' }, filters.month)).containers.map(
        (r) => r.id,
      ),
    ).toEqual([ids['literal-search']]);
    expect(
      (
        await reader.snapshot(
          {
            ...filters,
            inspection: 'yes',
            channel: '美森限时达',
            origin: '宁波',
            destination: '长滩',
          },
          filters.month,
        )
      ).containers.map((r) => r.id),
    ).toEqual([ids['missing-middle']]);
  });
  it('groups by departure month and reports distinct container vs delivery counts', async () => {
    const result = await reader.snapshot(filters, '2026-09');
    expect(result.containers.map((r) => r.id)).toContain(ids['previous-month']);
    const dashboard = overview(result, filters, 'postgres', now, 'mean');
    expect(dashboard.containers.count).toBe(5);
    expect(dashboard.warehouses.count).toBe(3);
    expect(dashboard.unclassifiedRouteCount).toBe(1);
    const detail = comparison(
      result,
      filters,
      'containers',
      'total',
      [ids['missing-middle']],
      'postgres',
      now,
    );
    expect(detail.entities[0].summary.mean).toBe(25);
    expect(detail.entities[0].stages.count).toBe(0);
  });
  it('fails explicitly instead of silently truncating large aggregate samples', async () => {
    const limited = new SqlReader(db as unknown as Queryable, 'szzhhq', '2026-11-10', 1);
    await expect(limited.snapshot(filters, filters.month)).rejects.toBeInstanceOf(
      DatasetTooLargeError,
    );
  });
});
