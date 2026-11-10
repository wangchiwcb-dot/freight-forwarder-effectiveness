import { Button, DatePicker, Input, Select } from 'antd';
import { ReloadOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { routes } from '../data/demo';
import type { Filters as FilterState, View } from '../domain/types';

export function Filters({
  value,
  onChange,
  onReset,
  view,
}: {
  value: FilterState;
  onChange: (value: FilterState) => void;
  onReset: () => void;
  view: View;
}) {
  const options = (key: 'origin' | 'destination' | 'channel', title: string) => [
    { value: 'all', label: title },
    ...[...new Set(routes.map((r) => r[key]))].map((v) => ({ value: v, label: v })),
  ];
  return (
    <section className="filters-bar" aria-label="时效筛选">
      <div className="filter-lead">
        <FilterOutlined />
        <span>筛选</span>
      </div>
      <div className="filter-control month-control">
        <label>开船月份</label>
        <DatePicker
          picker="month"
          value={dayjs(`${value.month}-01`)}
          format="YYYY 年 MM 月"
          allowClear={false}
          onChange={(date) => {
            if (date) onChange({ ...value, month: date.format('YYYY-MM') });
          }}
          aria-label="开船月份"
          disabledDate={(date) => date.isAfter(dayjs().endOf('month'))}
        />
      </div>
      <div className="filter-control">
        <label>起运港</label>
        <Select
          aria-label="起运港"
          value={value.origin}
          options={options('origin', '全部起运港')}
          onChange={(origin) => onChange({ ...value, origin })}
        />
      </div>
      <div className="filter-control">
        <label>目的港</label>
        <Select
          aria-label="目的港"
          value={value.destination}
          options={options('destination', '全部目的港')}
          onChange={(destination) => onChange({ ...value, destination })}
        />
      </div>
      <div className="filter-control channel-control">
        <label>渠道</label>
        <Select
          aria-label="渠道"
          value={value.channel}
          options={options('channel', '全部渠道')}
          onChange={(channel) => onChange({ ...value, channel })}
          popupMatchSelectWidth={230}
        />
      </div>
      <div className="filter-control">
        <label>查验情况</label>
        <Select
          aria-label="查验情况"
          value={value.inspection}
          options={[
            { value: 'all', label: '全部样本' },
            { value: 'no', label: '未查验' },
            { value: 'yes', label: '已查验' },
          ]}
          onChange={(inspection) => onChange({ ...value, inspection })}
        />
      </div>
      {view === 'containers' && (
        <div className="filter-control search-control">
          <label>柜号搜索</label>
          <Input
            aria-label="柜号搜索"
            prefix={<SearchOutlined />}
            placeholder="输入柜号"
            allowClear
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
          />
        </div>
      )}
      <Button className="reset-button" type="text" icon={<ReloadOutlined />} onClick={onReset}>
        重置
      </Button>
    </section>
  );
}
