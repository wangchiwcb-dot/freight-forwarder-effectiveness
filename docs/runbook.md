# 构建与运行说明

前后端、测试和部署包在同一仓库维护。阿里云香港服务器的 HTTPS、服务配置和更新方式见 [部署说明](deployment.md)。业务数据发布与应用部署分开管理。

## 本地演示

需要 Node.js 22.12+（推荐 24）。

```sh
npm ci
cp .env.example .env
npm run dev:api
```

另开终端运行 `npm run dev -- --host 127.0.0.1 --port 4173`，打开 http://127.0.0.1:4173 。Vite 把 `/api` 转发至本地 3001 端口，所有数据和聚合都来自后端。

## 校验与打包

```sh
npm run typecheck
npm test
npm run build
npm run test:sites
npm run test:e2e
npm run format:check
node scripts/package-release.mjs
```

浏览器测试默认使用本机 Chrome；CI 使用 Playwright Chromium。浏览器测试自动在 4175 端口启动生产构建，使用明确授权的演示模式。必须先 build。

构建产物：

- `dist/client/`：React 静态资源。
- `dist/api/server/index.js`：可直接由 Node.js 启动的 Fastify 服务。
- `artifacts/freight-times-0.2.0.tar.gz`：前后端、运行清单、数据库结构与运行文档。
- 同名 `.sha256`：完整性摘要。

压缩包不包含 .env、密码、业务数据、node_modules 或采集材料。解压后执行 `npm ci --omit=dev --ignore-scripts` 安装运行依赖，再配置环境。

## 生产环境配置

```dotenv
NODE_ENV=production
DATA_SOURCE=postgres
HOST=127.0.0.1
PORT=3001
STATIC_DIR=dist/client
SOURCE_TENANT=szzhhq
DATABASE_URL=postgresql://freight_public_api:REPLACE_ME@127.0.0.1:5432/freight_times
DB_POOL_MAX=5
DB_SSL=disable
RATE_LIMIT_MAX=120
TRUST_PROXY=loopback
```

`DB_SSL=disable` 仅适用于同机或可信私网链路；远程数据库使用 `verify-full` 和可验证的证书。不要将真实 DATABASE_URL 提交到仓库或传入 Vite 环境变量。

使用最小权限账户 `freight_public_api`，不要使用数据库超级用户或已有写入账号。`database/public_api_role.sql` 是部署时应用的权限准备脚本，不自动执行；管理员应单独安全设置密码。API 启动不会迁移、导入、发布或修改任何记录。

现有数据库须已应用 001–008 迁移，且业务视图所有者应具有底层表读取权限。`database/schema.sql` 和迁移用于新建空库；不能对已有生产库重放初次建库。若尚无已发布记录，接口返回空数据，不能通过放宽发布检查“修复”。

```sh
npm run start
curl --fail http://127.0.0.1:3001/health/ready
```

服务同时托管 `/` 前端和 `/api/v1` 接口。未知 API、缺失资源和写请求不会退回 HTML 页面。进程收到 SIGTERM/SIGINT 时关闭 HTTP 服务和连接池。

外网访问使用 HTTPS 与 Nginx 反向代理。默认 API 不信任 X-Forwarded-For；同机 Nginx 部署设置 `TRUST_PROXY=loopback`，Nginx 必须覆盖用户传入的转发头，以便按真实访问者限流。直连开发环境保持 `TRUST_PROXY=none`。

## Docker（可选）

```sh
docker build -t freight-times:0.2.0 .
docker run --env-file .env --name freight-times -p 127.0.0.1:3001:3001 freight-times:0.2.0
```

容器内使用非 root 用户。容器连接宿主机或现有 PostgreSQL 容器的地址，需要在部署方案确定后填写；容器内的 `127.0.0.1` 不是宿主机。镜像不包含业务数据库或真实凭据。GitHub CI 会实际构建镜像并检查 HTTP 与 API。

## 回滚

发布前记录当前代码提交、安装包摘要、镜像标签和环境文件位置。此版本只有只读查询，回滚应用可切回上一个安装包/镜像并重启服务，无需回滚业务数据。权限准备脚本与应用部署分开执行；撤销权限前确认没有其他使用方。

## 验证边界

SQL 集成测试在 PGlite 提供的隔离 PostgreSQL 引擎中执行全部结构迁移，并切换到实际受限角色验证读权限。2026-11-10 部署另已完成现有阿里云数据库联调：真实只读账户可查询，无法 INSERT/UPDATE/DELETE；应用与数据库均只监听回环地址。公网 HTTPS、四个页面、对比入口、手机导航通过 Chrome 检查。用户授权发布现有记录后，又使用真实数据验证了默认月份统计、筛选、四项航线/仓库对比及手机布局。9 月的 700 个有效送仓批次与数据库统计一致；10 月暂无有效送仓完成样本，保留空状态。
