export const dimensions = ['containers', 'routes', 'warehouses'] as const;
export type Dimension = (typeof dimensions)[number];
export type View = 'overview' | Dimension;
export type Metric = 'total' | 'sea' | 'tail';
export type Source = 'demo' | 'postgres';
export interface Filters {
  month: string;
  origin: string;
  destination: string;
  channel: string;
  inspection: 'all' | 'yes' | 'no';
  search: string;
}
export interface Summary {
  count: number;
  mean: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
}
export interface EntityLabel {
  id: string;
  name: string;
  subtitle: string;
}
export interface StageSummary {
  count: number;
  sea: number | null;
  port: number | null;
  devanning: number | null;
  tail: number | null;
}
export interface Milestone {
  name: string;
  date: string | null;
}
export interface EntitySummary extends EntityLabel {
  summary: Summary;
  stages: StageSummary;
  milestones: Milestone[];
}
export interface HistogramBin {
  name: string;
  count: number;
}
export interface RankingItem extends EntityLabel {
  value: number;
  count: number;
}
export interface TrendPoint {
  month: string;
  name: string;
  values: Record<string, number | null>;
}
export interface Metadata {
  source: Source;
  generatedAt: string;
  defaultMonth: string;
  months: string[];
  origins: string[];
  destinations: string[];
  channels: string[];
}
export interface ResponseMeta {
  source: Source;
  generatedAt: string;
  filters: Filters;
}
export interface OverviewResponse {
  meta: ResponseMeta;
  containers: Summary;
  warehouses: Summary;
  containerCohortCount: number;
  unclassifiedRouteCount: number;
  routeCount: number;
  warehouseCount: number;
  fastestRoute: RankingItem | null;
  history: {
    month: string;
    name: string;
    container: number | null;
    warehouse: number | null;
    fastest: number | null;
  }[];
  trendRoutes: EntityLabel[];
  routeTrends: TrendPoint[];
  routeRanking: RankingItem[];
  warehouseRanking: RankingItem[];
  containerDistribution: HistogramBin[];
}
export interface ComparisonResponse {
  meta: ResponseMeta;
  dimension: Dimension;
  metric: Metric;
  entities: EntitySummary[];
  overall: Summary;
  cohortCount: number;
  trend: TrendPoint[];
  distribution: HistogramBin[];
  ranking: RankingItem[];
}
export interface EntitiesResponse {
  items: EntitySummary[];
  page: number;
  pageSize: number;
  total: number;
}
export interface ApiError {
  error: { code: string; message: string; requestId: string };
}
