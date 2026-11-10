import { createHash } from 'node:crypto';
import type { EntityLabel } from '../shared/contracts.js';
const id = (prefix: string, values: unknown[]) =>
  `${prefix}_${createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 32)}`;
export function serviceLabel(service: string | null, carrier: string | null): EntityLabel | null {
  if (!service?.trim()) return null;
  return {
    id: id('r', [carrier ?? '', service]),
    name: carrier && !service.includes(carrier) ? `${carrier} ${service}` : service,
    subtitle: '具体航线产品 · 可按港口和渠道进一步筛选',
  };
}
export function warehouseLabel(code: string | null, name: string | null): EntityLabel | null {
  const key = code?.trim() || name?.trim();
  if (!key) return null;
  return {
    id: id('w', [key]),
    name: key,
    subtitle: name && name !== key ? name : '亚马逊仓库 · 实际送仓批次',
  };
}
