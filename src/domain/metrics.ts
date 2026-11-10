import dayjs from 'dayjs';
import type { Filters } from './types';
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
export const formatDays = (n: number | null) => (n === null ? '—' : n.toFixed(1));
