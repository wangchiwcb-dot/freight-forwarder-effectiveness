import type {
  ComparisonResponse,
  Dimension,
  EntityLabel,
  EntitySummary,
  Filters,
  HistogramBin,
  Metric,
  OverviewResponse,
  RankingItem,
  Source,
  Summary,
} from '../shared/contracts.js';
import type { Catalog, MetricRow, Snapshot } from './types.js';
import { recentMonths } from './dates.js';

const valuesOf = (rows: MetricRow[], metric: Metric) =>
  rows.flatMap((row) => (row[metric] === null ? [] : [row[metric]]));
export function summarize(values: number[]): Summary {
  if (!values.length) return { count: 0, mean: null, p90: null, min: null, max: null };
  const ordered = [...values].sort((a, b) => a - b);
  const index = (values.length - 1) * 0.9;
  const left = Math.floor(index);
  return {
    count: values.length,
    mean: values.reduce((sum, v) => sum + v, 0) / values.length,
    p90: ordered[left] + (ordered[Math.ceil(index)] - ordered[left]) * (index - left),
    min: ordered[0],
    max: ordered.at(-1)!,
  };
}
export function histogram(values: number[], metric: Metric): HistogramBin[] {
  const step = metric === 'total' ? 10 : 5;
  const maximum = values.reduce((max, value) => Math.max(max, value), step * 5);
  // Limit chart payload size while preserving every observation in the final overflow bucket.
  const count = Math.min(60, Math.ceil(maximum / step));
  const overflow = maximum > count * step;
  const bins = Array.from({ length: count }, (_, i) => ({
    name: i === count - 1 && overflow ? `${i * step}+` : `${i * step}–${(i + 1) * step}`,
    count: 0,
  }));
  for (const value of values) bins[Math.min(count - 1, Math.floor(value / step))].count++;
  return bins;
}
function labelFor(row: MetricRow, dimension: Dimension): EntityLabel | null {
  if (dimension === 'routes') return row.route;
  if (dimension === 'warehouses') return row.warehouse;
  return {
    id: row.shipmentId,
    name: row.containerNo ?? '柜号待确认',
    subtitle: `${row.route?.name ?? '航线待确认'} · ${row.departure} 开船`,
  };
}
export function groupRows(
  rows: MetricRow[],
  dimension: Dimension,
): Map<string, { label: EntityLabel; rows: MetricRow[] }> {
  const groups = new Map<string, { label: EntityLabel; rows: MetricRow[] }>();
  for (const row of rows) {
    const label = labelFor(row, dimension);
    if (!label) continue;
    const group = groups.get(label.id);
    if (group) group.rows.push(row);
    else groups.set(label.id, { label, rows: [row] });
  }
  return groups;
}
function entity(
  label: EntityLabel,
  rows: MetricRow[],
  dimension: Dimension,
  metric: Metric,
): EntitySummary {
  const keys = [
    'sea',
    'port',
    'devanning',
    ...(dimension === 'warehouses' ? ['tail'] : []),
  ] as const;
  const complete = rows.filter(
    (r) =>
      r.total !== null && keys.every((k) => r[k as 'sea' | 'port' | 'devanning' | 'tail'] !== null),
  );
  const mean = (key: 'sea' | 'port' | 'devanning' | 'tail') =>
    complete.length ? complete.reduce((sum, r) => sum + (r[key] ?? 0), 0) / complete.length : null;
  const row = rows[0];
  return {
    ...label,
    summary: summarize(valuesOf(rows, metric)),
    stages: {
      count: complete.length,
      sea: mean('sea'),
      port: mean('port'),
      devanning: mean('devanning'),
      tail: dimension === 'warehouses' ? mean('tail') : null,
    },
    milestones:
      dimension === 'containers' && row
        ? [
            { name: '开船', date: row.departure },
            { name: '到港', date: row.arrival },
            { name: '提柜', date: row.pickup },
            { name: '拆柜', date: row.devanned },
          ]
        : [],
  };
}
export function entitySummaries(
  rows: MetricRow[],
  dimension: Dimension,
  metric: Metric,
): EntitySummary[] {
  return [...groupRows(rows, dimension).values()]
    .map((group) => entity(group.label, group.rows, dimension, metric))
    .sort(
      (a, b) =>
        (a.summary.mean ?? Infinity) - (b.summary.mean ?? Infinity) ||
        a.name.localeCompare(b.name, 'zh-CN') ||
        a.id.localeCompare(b.id),
    );
}
function ranking(rows: MetricRow[], dimension: Dimension, metric: Metric): RankingItem[] {
  return entitySummaries(rows, dimension, metric).flatMap((e) =>
    e.summary.mean === null
      ? []
      : [
          {
            id: e.id,
            name: e.name,
            subtitle: e.subtitle,
            value: e.summary.mean,
            count: e.summary.count,
          },
        ],
  );
}
const current = (rows: MetricRow[], month: string) =>
  rows.filter((r) => r.departure.startsWith(month));
const responseMeta = (source: Source, filters: Filters, now: Date) => ({
  source,
  filters,
  generatedAt: now.toISOString(),
});

export function overview(
  snapshot: Snapshot,
  filters: Filters,
  source: Source,
  now: Date,
  statistic: 'mean' | 'p90',
): OverviewResponse {
  const containers = current(snapshot.containers, filters.month);
  const warehouses = current(snapshot.warehouses, filters.month);
  const routeRanking = ranking(containers, 'routes', 'total');
  const warehouseRanking = ranking(warehouses, 'warehouses', 'total');
  const trendRoutes = routeRanking
    .slice(0, 3)
    .map(({ id, name, subtitle }) => ({ id, name, subtitle }));
  const history = recentMonths(filters.month).map((month) => {
    const c = current(snapshot.containers, month),
      w = current(snapshot.warehouses, month);
    return {
      month,
      name: `${Number(month.slice(-2))}月`,
      container: summarize(valuesOf(c, 'total')).mean,
      warehouse: summarize(valuesOf(w, 'total')).mean,
      fastest: ranking(c, 'routes', 'total')[0]?.value ?? null,
    };
  });
  return {
    meta: responseMeta(source, filters, now),
    containers: summarize(valuesOf(containers, 'total')),
    warehouses: summarize(valuesOf(warehouses, 'total')),
    containerCohortCount: containers.length,
    unclassifiedRouteCount: containers.filter((r) => !r.route).length,
    routeCount: routeRanking.length,
    warehouseCount: warehouseRanking.length,
    fastestRoute: routeRanking[0] ?? null,
    history,
    trendRoutes,
    routeTrends: recentMonths(filters.month).map((month) => {
      const groups = groupRows(current(snapshot.containers, month), 'routes');
      return {
        month,
        name: `${Number(month.slice(-2))}月`,
        values: Object.fromEntries(
          trendRoutes.map((r) => [
            r.id,
            summarize(valuesOf(groups.get(r.id)?.rows ?? [], 'total'))[statistic],
          ]),
        ),
      };
    }),
    routeRanking: routeRanking.slice(0, 8),
    warehouseRanking: warehouseRanking.slice(0, 8),
    containerDistribution: histogram(valuesOf(containers, 'total'), 'total'),
  };
}
function fallbackLabel(
  id: string,
  catalog: Catalog,
  dimension: Dimension,
  historical: MetricRow[],
): EntityLabel {
  const list =
    dimension === 'routes' ? catalog.routes : dimension === 'warehouses' ? catalog.warehouses : [];
  return (
    list.find((e) => e.id === id) ??
    groupRows(historical, dimension).get(id)?.label ?? {
      id,
      name: '暂无公开数据',
      subtitle: '该对象当前不可用',
    }
  );
}
export function comparison(
  snapshot: Snapshot,
  filters: Filters,
  dimension: Dimension,
  metric: Metric,
  ids: string[] | undefined,
  source: Source,
  now: Date,
): ComparisonResponse {
  const history = dimension === 'warehouses' ? snapshot.warehouses : snapshot.containers;
  const rows = current(history, filters.month);
  const groups = groupRows(rows, dimension);
  const chosen =
    ids ??
    entitySummaries(rows, dimension, metric)
      .filter((e) => e.summary.count > 0)
      .slice(0, 3)
      .map((e) => e.id);
  const selectedRows = chosen.flatMap((id) => groups.get(id)?.rows ?? []);
  return {
    meta: responseMeta(source, filters, now),
    dimension,
    metric,
    entities: chosen.map((id) => {
      const group = groups.get(id);
      return entity(
        group?.label ?? fallbackLabel(id, snapshot.catalog, dimension, history),
        group?.rows ?? [],
        dimension,
        metric,
      );
    }),
    overall: summarize(valuesOf(rows, metric)),
    cohortCount: rows.length,
    trend: recentMonths(filters.month).map((month) => {
      const grouped = groupRows(current(history, month), dimension);
      return {
        month,
        name: `${Number(month.slice(-2))}月`,
        values: Object.fromEntries(
          chosen.map((id) => [id, summarize(valuesOf(grouped.get(id)?.rows ?? [], metric)).mean]),
        ),
      };
    }),
    distribution: histogram(valuesOf(selectedRows, metric), metric),
    ranking: ranking(rows, dimension, metric).slice(0, 8),
  };
}
export function pagedEntities(
  snapshot: Snapshot,
  filters: Filters,
  dimension: Dimension,
  metric: Metric,
  q: string,
  page: number,
  pageSize: number,
) {
  const rows = current(
    dimension === 'warehouses' ? snapshot.warehouses : snapshot.containers,
    filters.month,
  );
  const list = entitySummaries(rows, dimension, metric).filter(
    (e) =>
      e.summary.count > 0 &&
      `${e.name} ${e.subtitle}`.toLocaleLowerCase().includes(q.toLocaleLowerCase()),
  );
  return {
    items: list.slice((page - 1) * pageSize, page * pageSize),
    total: list.length,
    page,
    pageSize,
  };
}
