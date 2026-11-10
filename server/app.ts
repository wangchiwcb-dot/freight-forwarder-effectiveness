import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import type { Repository } from './types.js';
import { DatasetTooLargeError } from './repositories/postgres.js';
import { queries, dimensionSchema, filtersOnly } from './validation.js';
import { comparison, overview, pagedEntities } from './analytics.js';
import { monthAt, shiftMonth } from './dates.js';

export async function createApp(
  config: Config,
  repository: Repository,
  clock = () => new Date(),
  logger = false,
) {
  const app = Fastify({
    logger: logger
      ? { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie'] }
      : false,
    bodyLimit: 16384,
    requestTimeout: 15000,
    trustProxy: config.TRUST_PROXY === 'loopback' ? ['127.0.0.1', '::1'] : false,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
      },
    },
  });
  await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: '1 minute' });
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/health/'))
      reply.header('Cache-Control', 'no-store');
  });
  app.setErrorHandler((error, request, reply) => {
    const validation = error instanceof ZodError;
    const tooLarge = error instanceof DatasetTooLargeError;
    const statusCode =
      error &&
      typeof error === 'object' &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 503;
    const status = validation
      ? 400
      : tooLarge
        ? 422
        : statusCode >= 400 && statusCode < 500
          ? statusCode
          : 503;
    const code = validation
      ? 'INVALID_QUERY'
      : tooLarge
        ? 'QUERY_TOO_LARGE'
        : status === 429
          ? 'RATE_LIMITED'
          : status < 500
            ? 'BAD_REQUEST'
            : 'DATA_UNAVAILABLE';
    const message = validation
      ? '筛选参数格式不正确，请检查月份、指标与对比项。'
      : tooLarge
        ? '样本量超出当前处理上限，请缩小港口或渠道范围。'
        : status === 429
          ? '查询过于频繁，请稍后重试。'
          : status < 500
            ? '请求无法处理。'
            : '数据服务暂时不可用，请稍后重试。';
    if (status >= 500)
      request.log.error({ requestId: request.id, code }, 'Public data request failed');
    reply.code(status).send({ error: { code, message, requestId: request.id } });
  });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => {
    await repository.ready();
    return { status: 'ok', source: repository.source };
  });
  app.get('/api/v1/meta', async () => {
    const { routes: _routes, warehouses: _warehouses, ...catalog } = await repository.catalog();
    return {
      ...catalog,
      source: repository.source,
      generatedAt: clock().toISOString(),
      defaultMonth: shiftMonth(monthAt(clock()), -1),
    };
  });
  app.get('/api/v1/overview', async (request) => {
    const query = queries(clock()).overview.parse(request.query);
    const filters = filtersOnly(query);
    const snapshot = await repository.snapshot(filters, shiftMonth(filters.month, -5));
    return overview(snapshot, filters, repository.source, clock(), query.statistic);
  });
  app.get<{ Params: { dimension: string } }>('/api/v1/compare/:dimension', async (request) => {
    const dimension = dimensionSchema.parse(request.params.dimension);
    const query = queries(clock()).comparison.parse(request.query);
    const filters = filtersOnly(query);
    const snapshot = await repository.snapshot(filters, shiftMonth(filters.month, -5));
    return comparison(
      snapshot,
      filters,
      dimension,
      query.metric,
      query.ids,
      repository.source,
      clock(),
    );
  });
  app.get<{ Params: { dimension: string } }>('/api/v1/entities/:dimension', async (request) => {
    const dimension = dimensionSchema.parse(request.params.dimension);
    const query = queries(clock()).entities.parse(request.query);
    const filters = filtersOnly(query);
    const snapshot = await repository.snapshot(filters, filters.month);
    return pagedEntities(
      snapshot,
      filters,
      dimension,
      query.metric,
      query.q,
      query.page,
      query.pageSize,
    );
  });
  if (config.STATIC_DIR) {
    const root = resolve(config.STATIC_DIR);
    if (!existsSync(resolve(root, 'index.html')))
      throw new Error('STATIC_DIR must contain the frontend production build');
    await app.register(staticFiles, { root, prefix: '/', wildcard: false, cacheControl: false });
    app.setNotFoundHandler((request, reply) => {
      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        !request.url.startsWith('/api') &&
        !request.url.startsWith('/health') &&
        !request.url.split('?')[0].split('/').at(-1)?.includes('.') &&
        request.headers.accept?.includes('text/html')
      ) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
      }
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '请求的资源不存在。', requestId: request.id },
      });
    });
  } else
    app.setNotFoundHandler((request, reply) =>
      reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '请求的资源不存在。', requestId: request.id },
      }),
    );
  app.addHook('onClose', () => repository.close());
  return app;
}
