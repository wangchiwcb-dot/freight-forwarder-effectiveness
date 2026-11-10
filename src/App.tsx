import { useEffect, useState } from 'react';
import { Button, Drawer, Tag } from 'antd';
import {
  ArrowRightOutlined,
  BarChartOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CompassOutlined,
  DeploymentUnitOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  MenuOutlined,
  ShopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Filters } from './components/Filters';
import { defaultFilters, previousMonth } from './domain/metrics';
import type { Dimension, Filters as FilterState, View } from './domain/types';
import { Overview } from './pages/Overview';
import { Detail } from './pages/Detail';
import { useMetadata } from './api/client';
import { QueryState } from './components/QueryState';

const navigation: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: '时效总览', icon: <BarChartOutlined /> },
  { key: 'containers', label: '柜子时效', icon: <InboxOutlined /> },
  { key: 'routes', label: '航线时效', icon: <BranchesOutlined /> },
  { key: 'warehouses', label: '亚马逊仓库', icon: <ShopOutlined /> },
];
function viewFromHash(): View {
  const key = window.location.hash.slice(1);
  return navigation.some((n) => n.key === key) ? (key as View) : 'overview';
}
export default function App() {
  const metadata = useMetadata();
  const [initialized, setInitialized] = useState(false);
  const sourceLabel =
    metadata.data?.source === 'demo'
      ? '演示数据'
      : metadata.data?.source === 'postgres'
        ? '已发布数据'
        : metadata.error
          ? '连接异常'
          : '正在连接';
  const isDemo = metadata.data?.source === 'demo';
  const [view, setView] = useState<View>(viewFromHash);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [selections, setSelections] = useState<Record<Dimension, string[] | null>>({
    containers: null,
    routes: null,
    warehouses: null,
  });
  const [methodOpen, setMethodOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    const handler = () => {
      setView(viewFromHash());
      setFilters((f) => ({ ...f, search: '' }));
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    if (metadata.data && !initialized) {
      setFilters((f) => ({ ...f, month: metadata.data.defaultMonth }));
      setInitialized(true);
    }
  }, [metadata.data, initialized]);
  function navigate(next: View, entityId?: string) {
    setView(next);
    if (entityId && next !== 'overview') setSelections((s) => ({ ...s, [next]: [entityId] }));
    setFilters((f) => ({ ...f, search: '' }));
    window.location.hash = next;
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function changeFilters(next: FilterState) {
    setFilters(next);
    setSelections((s) => ({ ...s, containers: null }));
  }
  function resetFilters() {
    setFilters({ ...defaultFilters(), month: metadata.data?.defaultMonth ?? previousMonth() });
    setSelections({ containers: null, routes: null, warehouses: null });
  }
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
          document.getElementById('main-content')?.scrollIntoView();
        }}
      >
        跳转到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#overview"
            onClick={(event) => {
              event.preventDefault();
              navigate('overview');
            }}
            aria-label="中航环球，返回首页"
          >
            <img src="/brand-mark.png" alt="中航环球 Logo" />
            <span>
              <strong>中航环球</strong>
              <small>ZHONGHANG GLOBAL</small>
            </span>
          </a>
          <div className="brand-divider" />
          <span className="product-name">渠道时效</span>
          <nav className="desktop-nav" aria-label="主导航">
            {navigation.map((item) => (
              <button
                key={item.key}
                className={view === item.key ? 'active' : ''}
                aria-current={view === item.key ? 'page' : undefined}
                onClick={() => navigate(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button className="method-button" onClick={() => setMethodOpen(true)}>
              <InfoCircleOutlined /> 数据说明
            </button>
            <Button type="primary" icon={<SwapOutlined />} onClick={() => navigate('routes')}>
              时效对比
            </Button>
            <Button
              className="mobile-menu"
              aria-label="打开导航"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
            />
          </div>
        </div>
      </header>
      {view === 'overview' ? (
        <section className="hero">
          <div className="hero-inner">
            <div className="hero-copy">
              <div className="hero-eyebrow">
                <span /> TRANSIT TIME INSIGHTS
              </div>
              <h1>
                每一程，都有<span>数据可循。</span>
              </h1>
              <p>从开船到拆柜，从航线到仓库。让时效透明，让选择更有依据。</p>
              <div className="hero-tags">
                <span>
                  <CheckCircleOutlined /> 全链路节点分析
                </span>
                <span>
                  <DeploymentUnitOutlined /> 多维度时效对比
                </span>
                <Tag className="demo-tag">{sourceLabel}</Tag>
              </div>
            </div>
            <div className="hero-journey">
              <div className="journey-title">
                <CompassOutlined />
                <span>把不确定的航程，变成可见的进程</span>
              </div>
              <div className="journey-track">
                <div>
                  <span>
                    <CompassOutlined />
                  </span>
                  <strong>开船</strong>
                  <small>DEPARTURE</small>
                </div>
                <i />
                <div>
                  <span>
                    <InboxOutlined />
                  </span>
                  <strong>拆柜</strong>
                  <small>DEVANNING</small>
                </div>
                <i />
                <div>
                  <span>
                    <ShopOutlined />
                  </span>
                  <strong>送仓</strong>
                  <small>DELIVERY</small>
                </div>
              </div>
              <div className="journey-caption">
                <span>柜子 · 航线</span>
                <ArrowRightOutlined />
                <span>亚马逊仓库</span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="detail-topline">
          <div>
            <span>中航环球 / 时效洞察 / {navigation.find((n) => n.key === view)?.label}</span>
            <Tag bordered={false}>{sourceLabel}</Tag>
          </div>
        </div>
      )}
      <main className="main-content" id="main-content" tabIndex={-1}>
        {metadata.data && (
          <Filters
            value={filters}
            onChange={changeFilters}
            onReset={resetFilters}
            view={view}
            metadata={metadata.data}
          />
        )}
        <div className="data-context">
          <span>
            <i />{' '}
            {filters.month === (metadata.data?.defaultMonth ?? previousMonth())
              ? '默认查看上个月'
              : '自定义开船月份'}{' '}
            <span className="dot-separator">·</span> 各项指标分别统计有效样本
          </span>
          <button onClick={() => setMethodOpen(true)}>
            统计口径 <InfoCircleOutlined />
          </button>
        </div>
        {metadata.error || !metadata.data || !initialized ? (
          <QueryState error={metadata.error} retry={() => metadata.refetch()} />
        ) : view === 'overview' ? (
          <Overview filters={filters} onNavigate={navigate} />
        ) : (
          <Detail
            key={view}
            dimension={view}
            filters={filters}
            selectedIds={selections[view]}
            onSelect={(ids) => setSelections((s) => ({ ...s, [view]: ids }))}
            onBack={() => navigate('overview')}
          />
        )}
        <section className="method-strip">
          <span className="method-icon">
            <InfoCircleOutlined />
          </span>
          <div>
            <strong>读懂时效，先对齐口径</strong>
            <p>
              柜子与航线：实际开船 → 拆柜　｜　亚马逊仓库：实际开船 → 实际送仓　｜　P90：90%
              的样本在此天数内完成
            </p>
          </div>
          <button onClick={() => setMethodOpen(true)}>
            查看完整说明 <ArrowRightOutlined />
          </button>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <span>
            中航环球 <i /> ZHONGHANG GLOBAL
          </span>
          <small>让全球物流，更有确定性。</small>
        </div>
        <span>{isDemo ? '演示数据' : '历史时效参考'} · 非实际运输承诺</span>
      </footer>
      <Drawer
        title="数据与统计口径"
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        width={460}
      >
        <div className="method-content">
          <Tag color="gold" bordered={false}>
            {sourceLabel}
          </Tag>
          <h3>为时效选择提供参考</h3>
          <p>
            {isDemo
              ? '本页面由服务端提供模拟运输记录，展示筛选、对比和图表交互。尚未连接业务数据库，不能用作实际运输承诺。'
              : '本页面展示审核发布的有效运输记录。历史时效用于辅助选择，不代表未来运输承诺。'}
          </p>
          <h4>月份与样本</h4>
          <p>
            默认选中上一个自然月，目前为 {metadata.data?.defaultMonth ?? previousMonth()}
            。所有视角按实际开船月份归组，采用自然日；未完成、日期缺失或倒置的样本不进入对应时效统计，不以
            0 天代替。
          </p>
          <h4>柜子与航线</h4>
          <p>
            一个柜次代表一次独立运输，终点为实际拆柜。航线按具体航线产品分组，渠道为独立筛选维度；多批送仓不会重复增加柜次权重。
          </p>
          <h4>亚马逊仓库</h4>
          <p>
            以实际送达亚马逊仓库的有效批次为单位，终点为实际送仓，不等同上架。一个柜子可以贡献多个送仓批次；仓库比较可能同时包含不同航线，请配合起运港、目的港和渠道筛选。
          </p>
          <h4>均值与 P90</h4>
          <p>
            均值为有效样本自然日时效的算术平均值。P90 采用线性插值计算第 90
            百分位，小样本仅供参考。历史趋势按每个月的有效样本重新计算；空月份保留断点。近期月份仍有在途样本，已完成样本的均值可能偏低；不应直接视作该月全部运输的最终表现。
          </p>
          <h4>筛选与对比</h4>
          <p>
            全局筛选实时生效；点击「重置」回到上个月和全部筛选。航线与仓库最多同时选择四项。切换月份时保留航线、仓库选择，无样本显示为暂无数据；柜次选择随筛选重新初始化。
          </p>
          <h4>样本有效性</h4>
          <p>
            各项指标只使用其起止节点均有效的样本。分段堆叠图使用所有分段均齐全的共同样本，因此分段图与总时效卡片的样本量可能不同。缺少航线名称的柜次计入柜子总览，不计入航线排行。近期月份还有在途样本，请结合样本量理解平均值。
          </p>
        </div>
      </Drawer>
      <Drawer title="渠道时效" open={mobileOpen} onClose={() => setMobileOpen(false)} width={280}>
        <nav className="mobile-nav">
          {navigation.map((item) => (
            <Button
              key={item.key}
              type={view === item.key ? 'primary' : 'text'}
              icon={item.icon}
              onClick={() => navigate(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </Drawer>
    </div>
  );
}
