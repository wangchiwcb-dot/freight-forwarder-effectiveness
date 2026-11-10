import { useState } from 'react';
import { Button, Checkbox, Empty, Input, Modal, Tag } from 'antd';
import { SearchOutlined, CheckOutlined } from '@ant-design/icons';
import type { Dimension, Entity } from '../domain/types';
import { formatDays, summarize } from '../domain/metrics';

export function ComparePicker({
  dimension,
  entities,
  selected,
  open,
  onClose,
  onApply,
}: {
  dimension: Dimension;
  entities: Entity[];
  selected: string[];
  open: boolean;
  onClose: () => void;
  onApply: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(selected);
  const label = dimension === 'routes' ? '航线' : dimension === 'warehouses' ? '仓库' : '柜子';
  const filtered = entities.filter((e) =>
    `${e.name} ${e.subtitle}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
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
        placeholder={`搜索${label}${dimension === 'warehouses' ? '代码或城市' : '名称'}`}
        aria-label="搜索对比对象"
        value={query}
        allowClear
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="picker-list">
        {filtered.length === 0 ? (
          <Empty description="没有匹配的对比对象" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          filtered.map((e) => (
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
                  {formatDays(summarize(e.samples).mean)}
                  <small> 天</small>
                </strong>
                <Tag bordered={false}>
                  {e.samples.length} {dimension === 'warehouses' ? '批次' : '柜次'}
                </Tag>
              </div>
            </label>
          ))
        )}
      </div>
      <p className="picker-description">
        {dimension === 'warehouses'
          ? '仓库以有效送仓批次为样本，时效统计至实际送仓。'
          : '柜子与航线以独立运输为样本，时效统计至拆柜。'}
      </p>
    </Modal>
  );
}
