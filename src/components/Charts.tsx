import type { ReactNode } from 'react';
import { Empty } from 'antd';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const palette = ['#236a89', '#24a595', '#bc8e58', '#8e81ba', '#5b90bf', '#d48281'];
const tick = { fill: '#6d8290', fontSize: 12 };
const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #e6edf0',
  boxShadow: '0 8px 30px #122c4010',
  fontSize: 12,
};
export function ChartPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`chart-panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function ChartEmpty({ description = '当前筛选暂无有效样本' }: { description?: string }) {
  return (
    <div className="chart-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );
}
export function SparkChart({
  data,
  color,
  id,
  kind = 'area',
}: {
  data: { name: string; value: number | null }[];
  color: string;
  id: string;
  kind?: 'area' | 'bar';
}) {
  if (data.every((d) => d.value === null)) return <ChartEmpty />;
  return (
    <div className="spark-chart" role="img" aria-label="近六个月平均时效趋势，单位天">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {kind === 'bar' ? (
          <BarChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={tick}
              axisLine={false}
              tickLine={false}
              interval={0}
              dy={6}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [`${Number(v).toFixed(1)} 天`, '平均时效']}
              cursor={{ fill: '#f3f7f9' }}
            />
            <Bar isAnimationActive={false} dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={25}>
              {data.map((d, i) => (
                <Cell
                  key={d.name}
                  fill={color}
                  fillOpacity={i === data.length - 1 ? 1 : 0.24 + i * 0.08}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 10, right: 14, left: 14, bottom: 0 }}>
            <defs>
              <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="name"
              tick={tick}
              axisLine={false}
              tickLine={false}
              interval={0}
              dy={6}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => [`${Number(v).toFixed(1)} 天`, '平均时效']}
            />
            <Area
              isAnimationActive={false}
              type="monotone"
              dataKey="value"
              stroke={color}
              fill={`url(#gradient-${id})`}
              strokeWidth={2.3}
              dot={{ r: 2.5, fill: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function TrendChart({
  data,
  series,
  height = 270,
}: {
  data: Record<string, string | number | null>[];
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  if (!series.length || data.every((d) => series.every((s) => d[s.key] == null)))
    return <ChartEmpty />;
  return (
    <div style={{ height }} role="img" aria-label="平均时效趋势折线图，单位天">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 15, left: -17, right: 22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7edef" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={tick} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={tick} unit="天" />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} 天`]} />
          <Legend
            iconType="circle"
            iconSize={7}
            itemSorter={null}
            wrapperStyle={{ fontSize: 11, paddingTop: 18 }}
          />
          {series.map((s) => (
            <Line
              isAnimationActive={false}
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function RankingChart({
  data,
  onSelect,
  unit = '天',
}: {
  data: { id: string; name: string; value: number }[];
  onSelect?: (id: string) => void;
  unit?: string;
}) {
  if (!data.length) return <ChartEmpty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="ranking-chart" role="group" aria-label="平均时效排行">
      {data.map((d, i) => (
        <button
          key={d.id}
          className="ranking-row"
          onClick={() => onSelect?.(d.id)}
          disabled={!onSelect}
          aria-label={`${d.name} ${d.value.toFixed(1)} ${unit}${onSelect ? '，查看对比' : ''}`}
        >
          <span className="rank-number">{String(i + 1).padStart(2, '0')}</span>
          <span className="rank-body">
            <span className="rank-label">{d.name}</span>
            <span className="rank-track">
              <span
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: i === 0 ? '#2c9d92' : '#81a6ba',
                }}
              />
            </span>
          </span>
          <strong>
            {d.value.toFixed(1)}
            <small>{unit}</small>
          </strong>
        </button>
      ))}
    </div>
  );
}
export function StageChart({
  data,
  warehouse = false,
}: {
  data: Record<string, string | number>[];
  warehouse?: boolean;
}) {
  if (!data.length) return <ChartEmpty description="添加对比对象，查看分段时效" />;
  const stages = [
    { key: 'sea', name: '海上运输', color: '#326b89' },
    { key: 'port', name: '到港 → 提柜', color: '#70a2b9' },
    { key: 'devanning', name: '提柜 → 拆柜', color: '#94c7ce' },
    ...(warehouse ? [{ key: 'tail', name: '拆柜 → 送仓', color: '#25a795' }] : []),
  ];
  return (
    <div className="stage-chart" role="img" aria-label="各对比对象的平均分段时效，单位天">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart layout="vertical" data={data} margin={{ top: 8, bottom: 0, left: 6, right: 20 }}>
          <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#e7edef" />
          <XAxis type="number" tick={tick} axisLine={false} tickLine={false} unit="天" />
          <YAxis
            dataKey="name"
            type="category"
            width={100}
            tick={{ ...tick, fill: '#496271' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: '#f4f7f9' }}
            formatter={(v) => [`${Number(v).toFixed(1)} 天`]}
          />
          <Legend
            iconType="circle"
            iconSize={7}
            itemSorter={null}
            wrapperStyle={{ fontSize: 11, paddingTop: 18 }}
          />
          {stages.map((s, i) => (
            <Bar
              isAnimationActive={false}
              key={s.key}
              dataKey={s.key}
              name={s.name}
              stackId="a"
              fill={s.color}
              maxBarSize={30}
              radius={i === stages.length - 1 ? [0, 4, 4, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Histogram({
  data,
  color = '#2b9f96',
}: {
  data: { name: string; count: number }[];
  color?: string;
}) {
  if (!data.some((d) => d.count)) return <ChartEmpty />;
  return (
    <div style={{ height: 255 }} role="img" aria-label="时效天数分布柱状图">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 10, left: -22, right: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e7edef" />
          <XAxis
            dataKey="name"
            tick={tick}
            axisLine={false}
            tickLine={false}
            label={{
              value: '时效区间（天）',
              position: 'insideBottom',
              offset: -5,
              fontSize: 10,
              fill: '#93a0a8',
            }}
            height={45}
          />
          <YAxis tick={tick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => [`${v} 个`, '有效样本']}
            labelFormatter={(label) => `${label} 天（左闭右开，末档含上界）`}
            cursor={{ fill: '#f3f7f9' }}
          />
          <Bar
            isAnimationActive={false}
            dataKey="count"
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
