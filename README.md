# 中航环球 · 渠道时效系统

对外展示柜子、航线、亚马逊仓库时效，支持筛选、四项对比、分段图、趋势与分布。前端为 React + TypeScript + Ant Design + Recharts，后端为 Node.js + TypeScript + Fastify + PostgreSQL，使用 TanStack Query 管理请求。

前端实际调用后端 API；后端支持显式演示模式和现有 PostgreSQL 数据库。生产环境使用阿里云香港服务器、Nginx HTTPS 和只读数据库角色，配置见 [部署说明](docs/deployment.md)。本地预览默认使用明确标记的演示数据。

线上地址：[transit.omfreight.vip](https://transit.omfreight.vip)。历史记录尚未对外发布时，线上显示空数据。

## 启动

需要 Node.js 22.12+（推荐 24）与 npm。

```sh
npm ci
cp .env.example .env
npm run dev:api
```

另开终端运行 `npm run dev -- --host 127.0.0.1 --port 4173`，打开 http://127.0.0.1:4173 。

## 校验与构建

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
npm run package
```

生产构建输出至 `dist/client` 和 `dist/api`。`npm run start` 启动后端，通过 `STATIC_DIR=dist/client` 同时托管网页。部署包位于 `artifacts/`，含 SHA-256 摘要。详细配置见 [运行说明](docs/runbook.md)。

GitHub Actions 在推送 main 和 PR 时执行类型/格式检查、统计与 API 测试、真实 SQL 权限测试、生产构建、浏览器测试、Docker 构建与容器启动检查，并上传安装包。

## 仓库结构

```text
src/                     React 页面、组件与 API 请求层
shared/contracts.ts      前后端共用的请求/响应类型
server/
  app.ts                 只读 HTTP 接口与错误处理
  analytics.ts           均值/P90、分段、排名与分布
  repositories/postgres.ts 现有 PostgreSQL 有效视图适配
  repositories/demo.ts   显式模拟数据适配
  validation.ts          参数与比较上限检查
  config.ts              环境配置，生产默认使用数据库
  *.test.ts              API/统计/SQL 集成测试
database/                结构迁移与待部署的只读权限脚本
deploy/                  systemd、Nginx 与证书续期配置
tests/e2e/               实际前后端浏览器测试
Dockerfile               多阶段构建、非 root 运行
.github/workflows/ci.yml 自动验证与产物构建
```

本地仓库路径沿用早期的 `frontend/` 文件夹；这个 Git 仓库现在包含完整前后端。父目录的采集快照、客户数据、备份和凭据不在本仓库内。

## 功能与统计边界

- 首页展示三个视角，默认服务器上海时区上一个自然月。
- 按开船月份、起运港、目的港、渠道、查验筛选；柜子支持柜号检索。
- 航线和仓库候选项支持搜索分页，最多对比四项；切换月份或指标保留已选对象。
- 按独立柜次和送仓批次分别统计，航线与公司渠道独立。
- 各指标单独校验端点。总时效有效但中间节点缺失时保留总时效，分段图只使用各分段齐全的共同样本。
- 空数据用 null，不补零；缺失航线不强行分类。近期月份有在途偏差，数据不能作为运输承诺。
- 数据库查询仅允许固定公司、已发布、有效的海运记录，读取 `valid_container_metrics` / `valid_amazon_delivery_metrics`；无写入或批量发布接口。
- 真实数据库故障不会自动切到演示数据；前端提供错误与重试状态。

接口约定见 [API 文档](docs/api.md)，视觉说明见 [设计说明](docs/design-notes.md)。
