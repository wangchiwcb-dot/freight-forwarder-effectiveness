import dayjs from 'dayjs';
import { businessDate, monthAt } from './dates.js';
import type { Dataset, RouteDefinition, WarehouseDefinition } from './demo-types.js';

export const routes: RouteDefinition[] = [
  {
    id: 'clx',
    name: '美森 CLX',
    channel: '美森限时达',
    origin: '宁波',
    destination: '长滩',
    carrier: '美森',
    seaDays: 12,
    region: '美西',
  },
  {
    id: 'clx-plus',
    name: '美森 CLX+',
    channel: '美森限时达',
    origin: '宁波',
    destination: '长滩',
    carrier: '美森',
    seaDays: 15,
    region: '美西',
  },
  {
    id: 'zex',
    name: '以星 ZEX',
    channel: '盐田定时达',
    origin: '盐田',
    destination: '洛杉矶',
    carrier: '以星',
    seaDays: 14,
    region: '美西',
  },
  {
    id: 'sea',
    name: '东方海外 SEA',
    channel: '美国海运盐田卡派',
    origin: '盐田',
    destination: '洛杉矶',
    carrier: '东方海外',
    seaDays: 20,
    region: '美西',
  },
  {
    id: 'ec2',
    name: '现代商船 EC2',
    channel: '普船卡派-NYC',
    origin: '盐田',
    destination: '纽约',
    carrier: '现代商船',
    seaDays: 29,
    region: '美东',
  },
  {
    id: 'ec4',
    name: '长荣 EC4',
    channel: '义乌卡派-SVC',
    origin: '宁波',
    destination: '萨凡纳',
    carrier: '长荣',
    seaDays: 32,
    region: '美东',
  },
];
export const warehouses: WarehouseDefinition[] = [
  { id: 'ONT8', city: '莫雷诺谷 · 加利福尼亚', region: '美西' },
  { id: 'LGB8', city: '里亚托 · 加利福尼亚', region: '美西' },
  { id: 'LAX9', city: '丰塔纳 · 加利福尼亚', region: '美西' },
  { id: 'SBD1', city: '布卢明顿 · 加利福尼亚', region: '美西' },
  { id: 'ABE8', city: '佛罗伦萨 · 新泽西', region: '美东' },
  { id: 'SAV4', city: '普勒 · 佐治亚', region: '美东' },
];

// Reproducible synthetic fixtures. No customer records or production database access.
export function createDemoData(now = new Date()): Dataset {
  const anchor = dayjs(`${monthAt(now)}-01`);
  const today = businessDate(now);
  const shipments: Dataset['shipments'] = [];
  const deliveries: Dataset['deliveries'] = [];
  for (let offset = 12; offset >= 1; offset--) {
    const month = anchor.subtract(offset, 'month');
    const seed = month.year() * 12 + month.month();
    routes.forEach((route, r) => {
      const count = 20 + ((seed + r * 7) % 15);
      for (let i = 0; i < count; i++) {
        const inspected = (i + r) % 11 === 0;
        const departure = month.add((i * 3 + r) % 25, 'day');
        const seaDays = route.seaDays + ((i * 7 + seed) % 5) - 2 + (seed % 3);
        const arrival = departure.add(seaDays, 'day');
        const pickup = arrival.add(2 + (i % 3) + (inspected ? 5 : 0), 'day');
        const devanning = pickup.add(1 + (i % 2), 'day');
        const id = `${month.format('YYYYMM')}-${r}-${i}`;
        const actual = (date: dayjs.Dayjs) =>
          date.format('YYYY-MM-DD') <= today ? date.format('YYYY-MM-DD') : null;
        shipments.push({
          id,
          containerNo: `DEMO${String(seed * 1000 + r * 100 + i).slice(-7)}`,
          routeId: route.id,
          departure: departure.format('YYYY-MM-DD'),
          arrival: actual(arrival),
          pickup: actual(pickup),
          devanning: actual(devanning),
          inspected,
          published: true,
          active: true,
        });
        const destinations = warehouses.filter((w) => w.region === route.region);
        const batches = i % 3 === 0 ? 2 : 1;
        for (let b = 0; b < batches; b++) {
          const warehouse = destinations[(i + b) % destinations.length];
          deliveries.push({
            id: `${id}-${b}`,
            shipmentId: id,
            warehouseId: warehouse.id,
            actualDelivery: actual(devanning.add(3 + ((i * 3 + b * 2) % 8), 'day')),
            eligible: true,
          });
        }
      }
    });
  }
  return { shipments, deliveries };
}
