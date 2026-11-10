import { useState } from 'react';
import { Button, Segmented, Tooltip } from 'antd';
import {
  ArrowRightOutlined,
  BranchesOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { formatDays } from '../domain/metrics';
import { useOverview } from '../api/client';
import { QueryState } from '../components/QueryState';
import type { Dimension, Filters } from '../domain/types';
import {
  ChartPanel,
  Histogram,
  palette,
  RankingChart,
  SparkChart,
  TrendChart,
} from '../components/Charts';

export function Overview({
  filters,
  onNavigate,
}: {
  filters: Filters;
  onNavigate: (view: Dimension, entityId?: string) => void;
}) {
  const [trendMetric, setTrendMetric] = useState<'mean' | 'p90'>('mean');
  const query = useOverview(filters, trendMetric);
  if (query.isPending || query.error)
    return <QueryState error={query.error} retry={() => query.refetch()} />;
  const data = query.data;
  const containerSummary = data.containers;
  const warehouseSummary = data.warehouses;
  const fastest = data.fastestRoute;
  const trendRoutes = data.trendRoutes;
  const history = data.history;
  const routeHistory = data.routeTrends.map((point) => ({ name: point.name, ...point.values }));
  const cards = [
    {
      key: 'containers' as const,
      icon: <InboxOutlined />,
      title: '柜子时效',
      english: 'CONTAINER',
      color: palette[0],
      value: containerSummary.mean,
      label: '平均开船至拆柜',
      unit: '柜次',
      count: containerSummary.count,
      caption: '以每次运输为单位，还原柜子全程',
      trend: history.map((h) => ({ name: h.name, value: h.container })),
      foot: `P90 ${formatDays(containerSummary.p90)} 天`,
      kind: 'area' as const,
    },
    {
      key: 'routes' as const,
      icon: <BranchesOutlined />,
      title: '航线时效',
      english: 'SERVICE',
      color: palette[1],
      value: fastest?.value ?? null,
      label: '最快航线平均时效',
      unit: '条航线',
      count: data.routeCount,
      caption: '横向比较不同航线，选出合适的航程',
      trend: history.map((h) => ({ name: h.name, value: h.fastest })),
      foot: fastest?.name ?? '暂无有效样本',
      kind: 'bar' as const,
    },
    {
      key: 'warehouses' as const,
      icon: <ShopOutlined />,
      title: '亚马逊仓库',
      english: 'AMAZON FBA',
      color: palette[2],
      value: warehouseSummary.mean,
      label: '平均开船至送仓',
      unit: '批次',
      count: warehouseSummary.count,
      caption: '看见入仓前的每一步，交付更有把握',
      trend: history.map((h) => ({ name: h.name, value: h.warehouse })),
      foot: `覆盖 ${data.warehouseCount} 个仓库`,
      kind: 'area' as const,
    },
  ];
  return (
    <>
      <div className="section-heading">
        <div>
          <span className="eyebrow">PERFORMANCE OVERVIEW</span>
          <h2>三个视角，看清全程时效</h2>
        </div>
        <span className="section-meta">
          {filters.month.replace('-', ' 年 ')} 月开船样本 <span className="dot-separator">·</span>{' '}
          自然日口径
        </span>
      </div>
      <div className="overview-grid">
        {cards.map((card) => (
          <section className={`overview-card overview-${card.key}`} key={card.key}>
            <div className="overview-card-header">
              <span
                className="dimension-icon"
                style={{ color: card.color, backgroundColor: `${card.color}12` }}
              >
                {card.icon}
              </span>
              <h3>{card.title}</h3>
              <span className="card-english">{card.english}</span>
              <button
                className="circle-link"
                aria-label={`查看${card.title}详情`}
                onClick={() => onNavigate(card.key)}
              >
                <ArrowRightOutlined />
              </button>
            </div>
            <p className="card-description">{card.caption}</p>
            <div className="metric-line">
              <div>
                <p className="metric-label">{card.label}</p>
                <div className="metric-number">
                  {formatDays(card.value)}
                  <span>天</span>
                </div>
              </div>
              <div className="metric-support">
                <strong>{card.count}</strong>
                <span>{card.unit}</span>
              </div>
            </div>
            <SparkChart data={card.trend} color={card.color} id={card.key} kind={card.kind} />
            <div className="overview-card-footer">
              <span>
                <i style={{ background: card.color }} />
                {card.foot}
              </span>
              <button onClick={() => onNavigate(card.key)}>
                查看时效对比 <ArrowRightOutlined />
              </button>
            </div>
          </section>
        ))}
      </div>
      <p className="sample-note">
        本月共 {data.containerCohortCount} 个已发布有效柜次，其中 {data.containers.count}{' '}
        个具有有效开船至拆柜时效；{data.unclassifiedRouteCount} 个柜次尚未确认航线，不进入航线排行。
      </p>
      <div className="dashboard-grid">
        <ChartPanel
          title="主力航线时效走势"
          subtitle="开船至拆柜 · 同一航线跨月观察"
          action={
            <Segmented<'mean' | 'p90'>
              size="small"
              aria-label="走势统计方式"
              options={[
                { label: '平均时效', value: 'mean' },
                { label: 'P90 时效', value: 'p90' },
              ]}
              value={trendMetric}
              onChange={(v) => setTrendMetric(v)}
            />
          }
        >
          <TrendChart
            data={routeHistory}
            series={trendRoutes.map((r, i) => ({ key: r.id, name: r.name, color: palette[i] }))}
          />
          <div className="chart-footnote">
            <InfoCircleOutlined /> 基于当前筛选范围内，本月平均时效最快的三条航线
          </div>
        </ChartPanel>
        <ChartPanel
          title="航线时效一览"
          subtitle="平均开船至拆柜 · 越短越快 · 显示前 8 项"
          action={
            <Button size="small" type="text" onClick={() => onNavigate('routes')}>
              全部 <ArrowRightOutlined />
            </Button>
          }
        >
          <RankingChart data={data.routeRanking} onSelect={(id) => onNavigate('routes', id)} />
          <div className="chart-footnote">点击航线，查看分段时效与历史对比</div>
        </ChartPanel>
      </div>
      <div className="dashboard-grid lower-grid">
        <ChartPanel
          title="亚马逊仓库送仓表现"
          subtitle="平均开船至实际送仓 · 按送仓批次统计 · 前 8 项"
          action={
            <Button type="text" size="small" onClick={() => onNavigate('warehouses')}>
              对比仓库 <ArrowRightOutlined />
            </Button>
          }
        >
          <RankingChart
            data={data.warehouseRanking}
            onSelect={(id) => onNavigate('warehouses', id)}
          />
        </ChartPanel>
        <ChartPanel
          title="柜子时效分布"
          subtitle="开船至拆柜 · 样本数量分布"
          action={
            <Tooltip title="每个柜次只计入一个区间；区间左闭右开，最后一个区间包含上界。">
              <InfoCircleOutlined className="muted" />
            </Tooltip>
          }
        >
          <Histogram data={data.containerDistribution} />
        </ChartPanel>
      </div>
    </>
  );
}
