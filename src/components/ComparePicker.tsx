import { useEffect, useState } from 'react';
import { Button, Checkbox, Empty, Input, Modal, Pagination, Tag } from 'antd';
import { SearchOutlined, CheckOutlined } from '@ant-design/icons';
import type { Dimension, Filters, Metric } from '../domain/types';
import { formatDays } from '../domain/metrics';
import { useEntities } from '../api/client';
import { QueryState } from './QueryState';

export function ComparePicker({
  dimension,
  filters,
  metric,
  selected,
  selectedLabels,
  open,
  onClose,
  onApply,
}: {
  dimension: Dimension;
  filters: Filters;
  metric: Metric;
  selected: string[];
  selectedLabels: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(selected);
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(selectedLabels.map((e) => [e.id, e.name])),
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const entities = useEntities(filters, dimension, metric, search, page);
  useEffect(() => {
    if (entities.data)
      setNames((previous) => ({
        ...previous,
        ...Object.fromEntries(entities.data.items.map((e) => [e.id, e.name])),
      }));
  }, [entities.data]);
  const label = dimension === 'routes' ? '航线' : dimension === 'warehouses' ? '仓库' : '柜子';
  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < 4 ? [...d, id] : d));
  }
  return (
    <Modal
      title={`添加${label}对比`}
      open={open}
      onCancel={onClose}
      width={650}
      footer={
        <div className="picker-footer">
          <span>
            已选择 {draft.length} / 4 个{label}
          </span>
          <div>
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={() => onApply(draft)} icon={<CheckOutlined />}>
              应用对比
            </Button>
          </div>
        </div>
      }
    >
      <p className="picker-description">从当前筛选范围中选择，最多同时对比 4 个{label}。</p>
      <Input
        prefix={<SearchOutlined />}
        placeholder={`搜索${label}名称`}
        aria-label="搜索对比对象"
        value={query}
        allowClear
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="picker-selected">
        {draft.map((id) => (
          <Tag key={id} closable onClose={() => setDraft((d) => d.filter((value) => value !== id))}>
            {names[id] ?? `已选 ${draft.indexOf(id) + 1}`}
          </Tag>
        ))}
      </div>
      <div className="picker-list">
        {entities.isPending || entities.error ? (
          <QueryState error={entities.error} retry={() => entities.refetch()} />
        ) : entities.data.items.length === 0 ? (
          <Empty description="没有匹配的对比对象" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          entities.data.items.map((e) => (
            <label
              className={`picker-item ${draft.includes(e.id) ? 'is-selected' : ''}`}
              key={e.id}
            >
              <Checkbox
                checked={draft.includes(e.id)}
                disabled={!draft.includes(e.id) && draft.length >= 4}
                onChange={() => toggle(e.id)}
              />
              <div className="picker-item-copy">
                <strong>{e.name}</strong>
                <span>{e.subtitle}</span>
              </div>
              <div className="picker-item-value">
                <strong>
                  {formatDays(e.summary.mean)}
                  <small> 天</small>
                </strong>
                <Tag bordered={false}>
                  {e.summary.count} {dimension === 'warehouses' ? '批次' : '柜次'}
                </Tag>
              </div>
            </label>
          ))
        )}
      </div>
      {entities.data && entities.data.total > 20 && (
        <Pagination
          simple
          size="small"
          current={page}
          pageSize={20}
          total={entities.data.total}
          onChange={setPage}
        />
      )}
      <p className="picker-description">候选项与当前时效口径保持一致，切换页码不会丢失已选项。</p>
    </Modal>
  );
}
