import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { DemoRepository } from './repositories/demo.js';
import type { Repository } from './types.js';
const now = new Date('2026-11-10T04:00:00Z');
const apps: FastifyInstance[] = [];
async function app(repository: Repository = new DemoRepository(now), max = 10000) {
  const result = await createApp(
    readConfig({ DATA_SOURCE: 'demo', NODE_ENV: 'test', RATE_LIMIT_MAX: String(max) }),
    repository,
    () => now,
  );
  apps.push(result);
  return result;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

describe('public API', () => {
  it('returns metadata and derives the default month from server business time', async () => {
    const api = await app();
    const response = await api.inject('/api/v1/meta');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ source: 'demo', defaultMonth: '2026-10' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('serves all dashboard endpoints and distinct readiness/liveness probes', async () => {
    const api = await app();
    for (const path of [
      '/health/live',
      '/health/ready',
      '/api/v1/overview',
      '/api/v1/entities/routes',
      '/api/v1/compare/containers',
      '/api/v1/compare/routes',
      '/api/v1/compare/warehouses',
    ])
      expect((await api.inject(path)).statusCode).toBe(200);
  });
  it('filters genuinely change statistics; unmatched filters return null rather than fallback demo data', async () => {
    const api = await app();
    const full = (await api.inject('/api/v1/overview')).json();
    const narrow = (await api.inject('/api/v1/overview?origin=%E7%9B%90%E7%94%B0')).json();
    expect(narrow.containers.count).toBeLessThan(full.containers.count);
    const none = (await api.inject('/api/v1/overview?origin=NONE')).json();
    expect(none.containers.mean).toBeNull();
    expect(none.routeRanking).toEqual([]);
  });
  it('rejects invalid, future and excessive query input', async () => {
    const api = await app();
    for (const query of [
      'month=2026-13',
      'month=2027-01',
      'inspection=maybe',
      'unexpected=1',
      'month=2026-10&month=2026-09',
      'metric=evil',
      'ids=a,b,c,d,e',
      'ids=a,a',
    ]) {
      const response = await api.inject(`/api/v1/compare/routes?${query}`);
      expect(response.statusCode, query).toBe(400);
      expect(response.json().error.code).toBe('INVALID_QUERY');
    }
    expect((await api.inject('/api/v1/entities/routes?pageSize=1000')).statusCode).toBe(400);
    expect((await api.inject('/api/v1/compare/invalid')).statusCode).toBe(400);
  });
  it('paginates and searches candidates; comparison accepts selected IDs only', async () => {
    const api = await app();
    const page1 = (await api.inject('/api/v1/entities/containers?pageSize=2')).json();
    const page2 = (await api.inject('/api/v1/entities/containers?pageSize=2&page=2')).json();
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
    const selected = (
      await api.inject(`/api/v1/compare/containers?ids=${page1.items[0].id}`)
    ).json();
    expect(selected.entities).toHaveLength(1);
    expect(selected.entities[0].id).toBe(page1.items[0].id);
    expect((await api.inject('/api/v1/compare/routes?ids=')).json().entities).toEqual([]);
    const search = (await api.inject('/api/v1/entities/warehouses?q=ONT8')).json();
    expect(search.total).toBe(1);
    expect(search.items[0].name).toBe('ONT8');
  });
  it('does not emit underlying database errors or credentials', async () => {
    const repository = new DemoRepository(now);
    repository.snapshot = async () => {
      throw new Error('postgresql://admin:TOP_SECRET@private-host/db');
    };
    const api = await app(repository);
    const response = await api.inject('/api/v1/overview');
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('TOP_SECRET');
    expect(response.body).not.toContain('private-host');
    expect(response.json().error.requestId).toBeTruthy();
  });
  it('rejects unsupported writes and missing routes', async () => {
    const api = await app();
    expect(
      (await api.inject({ method: 'POST', url: '/api/v1/overview', payload: {} })).statusCode,
    ).toBe(404);
    expect((await api.inject('/api/v1/missing')).statusCode).toBe(404);
  });
  it('limits abusive request bursts', async () => {
    const api = await app(undefined, 1);
    await api.inject('/api/v1/meta');
    expect((await api.inject('/api/v1/meta')).statusCode).toBe(429);
  });
  it('fails closed for missing production database configuration or implicit production demo', () => {
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow();
    expect(() => readConfig({ NODE_ENV: 'production', DATA_SOURCE: 'demo' })).toThrow();
    expect(
      readConfig({ NODE_ENV: 'production', DATA_SOURCE: 'demo', ALLOW_PRODUCTION_DEMO: 'true' })
        .DATA_SOURCE,
    ).toBe('demo');
  });
});
