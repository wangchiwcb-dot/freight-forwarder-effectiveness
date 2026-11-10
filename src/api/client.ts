import { useQuery } from '@tanstack/react-query';
import type {
  ApiError,
  ComparisonResponse,
  Dimension,
  EntitiesResponse,
  Filters,
  Metadata,
  Metric,
  OverviewResponse,
} from '../../shared/contracts';

async function request<T>(
  path: string,
  parameters: Record<string, string | number | undefined>,
  signal?: AbortSignal,
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters))
    if (value !== undefined) query.set(key, String(value));
  const response = await fetch(`/api/v1/${path}${query.size ? `?${query}` : ''}`, {
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(error?.error?.message ?? '数据加载失败，请检查连接后重试。');
  }
  return response.json() as Promise<T>;
}
export const useMetadata = () =>
  useQuery({
    queryKey: ['metadata'],
    queryFn: ({ signal }) => request<Metadata>('meta', {}, signal),
    staleTime: 30000,
  });
export const useOverview = (filters: Filters, statistic: 'mean' | 'p90') =>
  useQuery({
    queryKey: ['overview', filters, statistic],
    queryFn: ({ signal }) =>
      request<OverviewResponse>('overview', { ...filters, statistic }, signal),
  });
export const useComparison = (
  filters: Filters,
  dimension: Dimension,
  metric: Metric,
  ids: string[] | null,
) =>
  useQuery({
    queryKey: ['comparison', dimension, filters, metric, ids],
    queryFn: ({ signal }) =>
      request<ComparisonResponse>(
        `compare/${dimension}`,
        { ...filters, metric, ids: ids?.join(',') },
        signal,
      ),
  });
export const useEntities = (
  filters: Filters,
  dimension: Dimension,
  metric: Metric,
  q: string,
  page: number,
) =>
  useQuery({
    queryKey: ['entities', dimension, filters, metric, q, page],
    queryFn: ({ signal }) =>
      request<EntitiesResponse>(
        `entities/${dimension}`,
        { ...filters, metric, q, page, pageSize: 20 },
        signal,
      ),
  });
