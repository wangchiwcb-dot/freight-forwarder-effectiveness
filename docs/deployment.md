# 阿里云部署与维护

部署目标为阿里云香港（`cn-hongkong`），访问域名为 `transit.omfreight.vip`。香港服务器提供本站服务无需中国大陆 ICP 备案；若将来迁至大陆服务器，需要先处理备案，二级域名不能绕过备案要求。

2026-11-10 已上线至 [https://transit.omfreight.vip](https://transit.omfreight.vip)。已验证 HTTPS、HTTP 跳转、生产数据库只读连接、四个页面、对比弹窗和手机导航。首页默认 2026 年 10 月；现有记录尚未发布，因此展示空数据。初次证书有效期至 2027-02-08，续期由服务器的 `certbot.timer` 执行；模拟续期及 Nginx 自动重载均已通过。

## 服务结构

公网 HTTPS → Nginx → `127.0.0.1:3001` 的只读 API 与前端 → `127.0.0.1:5432` 的现有 PostgreSQL。数据库容器保持原有配置，部署不重建数据库、不导入数据、不修改发布状态。

| 项目           | 位置                                                   |
| -------------- | ------------------------------------------------------ |
| 独立服务账户   | `freight-public`，无登录 Shell                         |
| 发布目录       | `/opt/freight-public/releases/<release-id>/`           |
| 当前版本链接   | `/opt/freight-public/current`                          |
| Node.js        | `/opt/freight-public/runtime/node-v24.22.2-linux-x64/` |
| 环境配置       | `/etc/freight-public/api.env`，root 所有且权限 0600    |
| 应用服务       | `freight-public.service`                               |
| Nginx 配置     | `/etc/nginx/sites-available/freight-public`            |
| 证书           | `/etc/letsencrypt/live/transit.omfreight.vip/`         |
| 证书续期       | `certbot.timer`，成功后自动重新加载 Nginx              |
| 数据库只读账户 | `freight_public_api`                                   |

Node.js 安装包须从官方来源下载，并与对应版本 `SHASUMS256.txt` 核对。系统安装 Nginx、Certbot；应用运行依赖使用锁文件和 `npm ci --omit=dev --ignore-scripts` 安装。systemd 禁止服务写入系统文件，限制内存，异常退出自动重启，开机自动启动。

## 首次配置

1. 在域名管理中增加 `transit` 的 A 记录，指向目标服务器公网 IP；没有可用 IPv6 时不要添加 AAAA 记录。云防火墙仅增加 TCP 80、443，应用与数据库保持回环地址监听。
2. 将经过测试的发布包和 SHA-256 文件上传至新的发布目录，核验摘要、解压并安装运行依赖。不要覆盖原有数据库目录。
3. 备份数据库，以管理员身份执行 `database/public_api_role.sql`，另行生成随机密码并安全设置。密码仅写入 root 可读环境文件；不要放进命令行参数、日志、Git 或前端环境变量。
4. 配置 `NODE_ENV=production`、`DATA_SOURCE=postgres`、`SOURCE_TENANT=szzhhq`、`HOST=127.0.0.1`、`PORT=3001`、`STATIC_DIR=dist/client`、`DB_SSL=disable`、`TRUST_PROXY=loopback`，以及只读角色的 `DATABASE_URL`。
5. 安装 `deploy/freight-public.service`，设置当前版本链接，执行 `systemctl daemon-reload` 与 `systemctl enable --now freight-public`，核验本机健康接口。
6. 安装 `deploy/nginx-http.conf` 进行证书验证。`nginx-default.conf` 只适用于尚无其他站点的服务器；已有站点不可覆盖。先 `nginx -t` 再 reload。
7. DNS 生效后执行 `certbot certonly --webroot -w /var/www/freight-acme -d transit.omfreight.vip --non-interactive --agree-tos --register-unsafely-without-email`。随后安装 `nginx-https.conf`，核验并重新加载；HTTP 自动跳转 HTTPS。
8. 将 `deploy/renewal-reload.sh` 安装为 `/etc/letsencrypt/renewal-hooks/deploy/freight-public-reload`，权限 0755。启用 `certbot.timer` 并执行 `certbot renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew` 验证续期。当前未设置证书通知邮箱，可由域名管理员后续补充。

`TRUST_PROXY=loopback` 仅信任同机代理，且 Nginx 会覆盖外部传入的 `X-Forwarded-For`。禁止直接将 API 绑定公网或改成信任任意代理。

## 验收与排查

```sh
systemctl is-active freight-public nginx
systemctl is-enabled freight-public nginx certbot.timer
curl --fail http://127.0.0.1:3001/health/ready
curl --fail https://transit.omfreight.vip/health/ready
curl --fail https://transit.omfreight.vip/api/v1/meta
journalctl -u freight-public --since '10 minutes ago' --no-pager
nginx -t
certbot certificates
```

健康接口应返回 `source: postgres`。上线还须用真实浏览器检查首页、三个详细视角、筛选、对比入口，以及页面与接口均无错误。无已发布记录时，空图表是正确结果，不能更改查询条件或启用演示模式冒充真实数据。

在安装了 Chrome 的开发电脑上运行 `npm run verify:live` 可检查线上四个视角、默认月份、对比弹窗、说明与移动布局。报告和截图保存至未纳入 Git 的 `artifacts/live-verification/`。脚本只访问公开页面和只读接口，可用 `LIVE_URL` 指定另一个部署地址。

## 数据发布边界

首次部署前的检查显示现有 2,936 条运输记录均未发布。应用的部署授权不包含批量发布历史记录。发布需明确确定范围、生成可审核清单、备份并记录审计信息；本部署仅创建只读角色和运行服务。业务账户权限与数据库备份仍沿用原有管理方式。

## 后续更新与回滚

每次更新先在新目录解压安装包并核验摘要，保留此前版本、配置及证书。只切换 `current` 链接并重启 `freight-public`；检查本机和公网健康接口、默认月份及浏览器页面。失败时将链接切回此前版本后重启服务。不得删除 PostgreSQL 数据卷、重放初始建库 SQL 或把环境文件放入发布包。

依赖 Node.js 的固定路径如果升级，应同步更新 systemd 配置并重新加载。Nginx 修改先检查再 reload；证书续期无需重启应用或数据库。
