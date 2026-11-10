import { useMemo, useState } from 'react';
import { Button, Segmented, Tag, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  CloseOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { dataset, routes, warehouses } from '../data/demo';
import {
  distribution,
  formatDays,
  getEntities,
  getSamples,
  recentMonths,
  summarize,
} from '../domain/metrics';
import type { Dimension, Entity, Filters, Metric, Sample } from '../domain/types';
import {
  ChartEmpty,
  ChartPanel,
  Histogram,
  palette,
  RankingChart,
  StageChart,
  TrendChart,
} from '../components/Charts';
import { ComparePicker } from '../components/ComparePicker';

const labels = { containers: '柜子', routes: '航线', warehouses: '亚马逊仓库' };
export function Detail({
  dimension,
  filters,
  selectedIds,
  onSelect,
  onBack,
}: {
  dimension: Dimension;
  filters: Filters;
  selectedIds: string[] | null;
  onSelect: (ids: string[]) => void;
  onBack: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [metric, setMetric] = useState<Metric>('total');
  const samples = useMemo(() => getSamples(dataset, filters, dimension), [filters, dimension]);
  const entities = useMemo(() => getEntities(samples, dimension), [samples, dimension]);
  const chosenIds = selectedIds ?? entities.slice(0, 3).map((e) => e.id);
  const chosen: Entity[] = chosenIds.map(
    (id) =>
      entities.find((e) => e.id === id) ?? {
        id,
        name: dimension === 'routes' ? (routes.find((r) => r.id === id)?.name ?? id) : id,
        subtitle:
          dimension === 'warehouses'
            ? (warehouses.find((w) => w.id === id)?.city ?? '')
            : '当前筛选下暂无有效样本',
        samples: [],
      },
  );
  const selectedSamples = chosen.flatMap((e) => e.samples);
  const totalLabel = dimension === 'warehouses' ? '开船 → 送仓' : '开船 → 拆柜';
  const metricLabel =
    metric === 'total'
      ? totalLabel
      : metric === 'sea'
        ? '开船 → 到港'
        : dimension === 'warehouses'
          ? '拆柜 → 送仓'
          : '到港 → 拆柜';
  const stageData = chosen
    .filter((e) => e.samples.length)
    .map((e) => ({
      name: e.name,
      ...Object.fromEntries(
        ['sea', 'port', 'devanning', ...(dimension === 'warehouses' ? ['tail'] : [])].map((key) => [
          key,
          e.samples.reduce(
            (sum, s) => sum + s[key as keyof Pick<Sample, 'sea' | 'port' | 'devanning' | 'tail'>],
            0,
          ) / e.samples.length,
        ]),
      ),
    }));
  const trend = recentMonths(filters.month).map((month) => {
    const monthly = getEntities(getSamples(dataset, { ...filters, month }, dimension), dimension);
    return {
      name: `${Number(month.slice(-2))}月`,
      ...Object.fromEntries(
        chosen.map((e) => [
          e.id,
          summarize(monthly.find((m) => m.id === e.id)?.samples ?? [], metric).mean,
        ]),
      ),
    };
  });
  const allSummary = summarize(samples, metric);
  return (
    <>
      <div className="detail-heading">
        <div>
          <button className="back-link" onClick={onBack}>
            <ArrowLeftOutlined /> 返回时效总览
          </button>
          <h2>
            {labels[dimension]}时效对比 <Tag bordered={false}>按开船月份统计</Tag>
          </h2>
          <p>
            {dimension === 'containers'
              ? '定位单次运输，比较不同柜子的节点表现。'
              : dimension === 'routes'
                ? '把不同航线放在一起，找到更适合你的运输方案。'
                : '比较不同目的仓的实际送仓表现，让备货计划更从容。'}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setPickerOpen(true)}>
          添加{dimension === 'warehouses' ? '仓库' : labels[dimension]}对比
        </Button>
      </div>
      <div className="comparison-toolbar">
        <div>
          <strong>对比对象</strong>
          <span>{chosen.length} / 4</span>
          <Tooltip title="最多同时对比四项；缺失样本显示为暂无数据，不补零。">
            <InfoCircleOutlined />
          </Tooltip>
        </div>
        <Segmented<Metric>
          aria-label="时效口径"
          value={metric}
          onChange={(v) => setMetric(v)}
          options={[
            { label: totalLabel, value: 'total' },
            { label: '海上运输', value: 'sea' },
            { label: dimension === 'warehouses' ? '拆柜 → 送仓' : '到港 → 拆柜', value: 'tail' },
          ]}
        />
      </div>
      <div className="comparison-grid">
        {chosen.map((entity, i) => {
          const summary = summarize(entity.samples, metric);
          return (
            <section
              className="comparison-card"
              key={entity.id}
              style={{ borderTopColor: palette[i] }}
            >
              <button
                className="remove-comparison"
                aria-label={`移除${entity.name}`}
                onClick={() => onSelect(chosenIds.filter((id) => id !== entity.id))}
              >
                <CloseOutlined />
              </button>
              <span className="comparison-name">
                <i style={{ background: palette[i] }} />
                {entity.name}
              </span>
              <p className="comparison-subtitle">{entity.subtitle}</p>
              <span className="metric-label">平均时效 · {metricLabel}</span>
              <div className="comparison-value">
                {formatDays(summary.mean)}
                <span>天</span>
                {summary.count === 0 && <Tag>暂无数据</Tag>}
              </div>
              <div
                className="comparison-range"
                aria-label={`P90 时效 ${formatDays(summary.p90)} 天`}
              >
                <div
                  style={{
                    width: `${Math.min(100, ((summary.mean ?? 0) / 60) * 100)}%`,
                    background: palette[i],
                  }}
                />
                <i
                  style={{
                    left: `${Math.min(100, ((summary.p90 ?? 0) / 60) * 100)}%`,
                    background: palette[i],
                  }}
                />
              </div>
              <div className="comparison-meta">
                <span>
                  P90 <b>{formatDays(summary.p90)}</b> 天
                </span>
                <span>
                  {summary.count} {dimension === 'warehouses' ? '批次' : '柜次'}
                </span>
              </div>
            </section>
          );
        })}
        {chosen.length < 4 && (
          <button className="add-comparison-card" onClick={() => setPickerOpen(true)}>
            <span>
              <PlusOutlined />
            </span>
            <strong>添加{dimension === 'warehouses' ? '仓库' : labels[dimension]}</strong>
            <small>最多同时对比 4 项</small>
          </button>
        )}
      </div>
      <div className="detail-grid">
        <ChartPanel
          title="全程分段时效"
          subtitle={`${totalLabel} · 平均耗时（天）`}
          action={
            <Tag bordered={false} color="cyan">
              固定全程口径
            </Tag>
          }
        >
          <StageChart data={stageData} warehouse={dimension === 'warehouses'} />
          <div className="chart-footnote">
            <InfoCircleOutlined /> 分段图始终展示全程，便于定位耗时环节
          </div>
        </ChartPanel>
        <ChartPanel
          title={dimension === 'containers' ? '单柜节点进度' : '历史时效走势'}
          subtitle={
            dimension === 'containers'
              ? '开船、到港、提柜、拆柜 · 实际日期'
              : `${metricLabel} · 近六个月平均时效`
          }
        >
          {dimension === 'containers' ? (
            chosen.length === 0 ? (
              <ChartEmpty description="添加柜子后查看实际节点" />
            ) : (
              <div className="milestone-list">
                {chosen.map((e, i) => (
                  <div className="milestone-item" key={e.id}>
                    <div className="milestone-name">
                      <i style={{ background: palette[i] }} />
                      {e.name}
                    </div>
                    {e.samples[0] ? (
                      <div className="milestone-track">
                        {[
                          { name: '开船', date: e.samples[0].shipment.departure },
                          { name: '到港', date: e.samples[0].shipment.arrival },
                          { name: '提柜', date: e.samples[0].shipment.pickup },
                          { name: '拆柜', date: e.samples[0].shipment.devanning },
                        ].map((item) => (
                          <div key={item.name}>
                            <i style={{ borderColor: palette[i] }} />
                            <strong>{item.date?.slice(5).replace('-', '/')}</strong>
                            <small>{item.name}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">当前月份暂无该柜次数据</p>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <TrendChart
              data={trend}
              series={chosen.map((e, i) => ({ key: e.id, name: e.name, color: palette[i] }))}
            />
          )}
        </ChartPanel>
      </div>
      <div className="detail-grid">
        <ChartPanel
          title="对比样本时效分布"
          subtitle={`${metricLabel} · 仅包含当前已选对象的有效样本`}
        >
          <Histogram data={distribution(selectedSamples, metric)} />
        </ChartPanel>
        <ChartPanel
          title={`当前筛选下的${labels[dimension]}表现`}
          subtitle={`${metricLabel} · 按平均时效由短到长，最多显示 8 项`}
          action={
            <Button type="text" size="small" onClick={() => setPickerOpen(true)}>
              选择对比 <PlusOutlined />
            </Button>
          }
        >
          <RankingChart
            data={entities
              .map((e) => ({ id: e.id, name: e.name, value: summarize(e.samples, metric).mean! }))
              .sort((a, b) => a.value - b.value)
              .slice(0, 8)}
            onSelect={(id) => {
              if (!chosenIds.includes(id)) {
                if (chosenIds.length >= 4) setPickerOpen(true);
                else onSelect([...chosenIds, id]);
              } else setPickerOpen(true);
            }}
          />
        </ChartPanel>
      </div>
      <div className="sample-note">
        <InfoCircleOutlined />
        <span>
          当前筛选包含 <strong>{allSummary.count}</strong> 个有效
          {dimension === 'warehouses' ? '送仓批次' : '柜次'}。对比卡片的实色条表示均值，竖线表示
          P90，统一以 60 天为标尺；样本为 1 时 P90 与该次时效相同。
        </span>
      </div>
      {pickerOpen && (
        <ComparePicker
          key={dimension}
          dimension={dimension}
          entities={entities}
          selected={chosenIds.filter((id) => entities.some((e) => e.id === id))}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onApply={(ids) => {
            onSelect(ids);
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
