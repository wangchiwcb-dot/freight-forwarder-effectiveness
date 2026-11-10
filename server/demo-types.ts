export type View = 'overview' | 'containers' | 'routes' | 'warehouses';
export type Dimension = Exclude<View, 'overview'>;
export type Metric = 'total' | 'sea' | 'tail';
export interface RouteDefinition {
  id: string;
  name: string;
  channel: string;
  origin: string;
  destination: string;
  carrier: string;
  seaDays: number;
  region: '美西' | '美东';
}
export interface WarehouseDefinition {
  id: string;
  city: string;
  region: '美西' | '美东';
}
export interface Shipment {
  id: string;
  containerNo: string;
  routeId: string;
  departure: string;
  arrival: string | null;
  pickup: string | null;
  devanning: string | null;
  inspected: boolean;
  published: boolean;
  active: boolean;
}
export interface Delivery {
  id: string;
  shipmentId: string;
  warehouseId: string;
  actualDelivery: string | null;
  eligible: boolean;
}
export interface Dataset {
  shipments: Shipment[];
  deliveries: Delivery[];
}
export interface Filters {
  month: string;
  origin: string;
  destination: string;
  channel: string;
  inspection: 'all' | 'yes' | 'no';
  search: string;
}
export interface Sample {
  id: string;
  label: string;
  shipment: Shipment;
  warehouseId?: string;
  total: number;
  sea: number;
  port: number;
  devanning: number;
  tail: number;
}
export interface Summary {
  count: number;
  mean: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
}
export interface Entity {
  id: string;
  name: string;
  subtitle: string;
  samples: Sample[];
}
