# QuoteFlow

面向小型外贸团队的一键报价系统。QuoteFlow 将产品资料、客户信息、报价版本和 PI 长图导出集中到一个工作台，减少重复排版与手工计算，同时保留每一轮正式报价的完整快照。

日常使用请阅读：[QuoteFlow 实用操作教程](docs/USER_GUIDE.zh-CN.md)

## 核心功能

- **产品资料库**：维护 P/N、英文描述、单位、常规 USD 单价、扩展属性和产品图片；同一 P/N 可保存不同 Description 变体，支持归档而不破坏历史报价。
- **Excel 批量导入**：兼容常见外贸产品表，可直接读取 `.xlsx` 内嵌图片，也支持 Excel 搭配图片 ZIP；导入前预览新增、更新、重复和缺图记录。
- **客户管理**：To、Tel、Email、Tax ID、Ship to 均可选填，适应客户资料不完整的实际场景。
- **快速报价**：搜索选品、拖动排序、填写数量、USD 单价与运费；产品常规单价会自动带入，金额使用 Decimal 精确计算。
- **PI 自动编号**：按业务员、上海日期和当日流水生成编号，例如 `Mandy2025042301`。
- **报价版本**：正式导出后锁定 R01，再次修改会复制为 R02，历史版本及图片保持不变。
- **PNG/PDF 导出**：独立 Worker 调用 Chromium 生成单页高清文件，每轮同时提供有银行信息和无银行信息的 PNG、PDF 两种版本。
- **角色权限**：管理员维护账号、公司资料和产品库；业务员只能管理自己的客户与报价。
- **响应式界面**：桌面端和移动端均可完成产品、客户、账号及报价操作。
- **Google Drive 备份**：管理员授权一次即可备份数据库与业务文件，后续更新同一个云端备份文件。

## 技术架构

QuoteFlow 采用模块化单体架构，适合 50–100 个产品、每个产品一张图片的轻量业务场景。

| 模块 | 技术 |
| --- | --- |
| Web 与 API | Next.js 16、React 19、TypeScript |
| UI | Fluent UI React |
| 数据库 | PostgreSQL 16、Prisma |
| 文件处理 | Sharp、ExcelJS、AdmZip |
| 金额计算 | Decimal.js |
| 报价导出 | Chromium、Playwright Core、独立 Worker |
| 部署 | Docker Compose、Caddy HTTPS |
| 云端备份 | Google Drive API、AES-256-GCM |

结构化数据保存在 PostgreSQL；产品图片、公司文件与报价 PNG/PDF 保存在独立持久化目录。数据库只记录相对路径，不保存 Base64 或图片二进制。

## 本地开发

环境要求：Node.js 22、pnpm 11、Docker Desktop，以及 Chrome 或 Chromium。

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

另开一个终端启动报价导出 Worker：

```bash
pnpm worker:dev
```

访问 [http://localhost:3000](http://localhost:3000)。本地种子账号如下：

| 角色 | 邮箱 | 初始密码 |
| --- | --- | --- |
| 管理员 | `admin@quoteflow.local` | `ChangeMe123!` |
| 业务员 | `mandy@quoteflow.local` | `ChangeMe123!` |

正式使用前必须修改初始密码，并替换 `.env` 中的示例密钥。真实 `.env` 文件和 `data` 目录已被 Git 忽略。

## 产品导入

Excel 必填列为 `P/N`（也支持 `Item Number`）、`Description`、`Unit`，可选列为 `Name`、`Regular Price` / `Unit Price (USD)`、`Image File`。系统会自动在前 30 行寻找产品表头，其他非空列（例如 `Color`）会保存为扩展属性。

`.xlsx` 内嵌产品图片可直接读取，无需额外整理。也可以同时上传图片 ZIP；ZIP 可以包含子目录，系统优先按 `Image File` 匹配，未填写时按 P/N 匹配 JPG、PNG 或 WebP。产品身份为 `P/N + 完整 Description`：相同身份更新，同 P/N 不同 Description 会新增为产品变体，同一文件内完全相同的记录会标记为重复。

## 一键生产部署

准备一台已安装 Docker Engine 与 Docker Compose 插件的 Linux 服务器，并将域名解析到服务器，然后执行：

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh quote.example.com
```

部署脚本会自动：

- 生成数据库密码、会话密钥、导出密钥和初始账号密码；
- 创建持久化数据目录；
- 构建镜像并启动 PostgreSQL；
- 执行数据库迁移和首次初始化；
- 启动 Web、导出 Worker 与 Caddy HTTPS；
- 配置健康检查、自动重启和日志滚动。

没有域名时可直接执行 `./scripts/deploy.sh`，然后通过 `http://服务器IP` 访问。部署配置保存在权限为 `600` 的 `.env.production` 中；更新代码后再次运行同一命令即可，现有密码和数据不会被覆盖，生产迁移也不会自动清空业务数据。

默认数据目录为 `/data/quoteflow`。生产环境只开放 `80/443`，PostgreSQL 与应用端口不会直接暴露到公网。

常用运维命令：

```bash
docker compose --env-file .env.production -f compose.production.yml ps
docker compose --env-file .env.production -f compose.production.yml logs -f app worker
docker compose --env-file .env.production -f compose.production.yml restart app worker
```

## Google Drive 在线备份

管理员可在“在线备份”页面绑定 Google Drive，将 PostgreSQL 转储、产品图片、报价 PNG/PDF、导入文件和公司资料打包为 `QuoteFlow-latest-backup.tar.gz`。首次备份创建文件，之后更新同一个 Drive 文件并核对 MD5。PostgreSQL 原始数据目录不会打包，避免不一致的物理备份。

VPS 仅使用 `/tmp` 临时打包，上传完成后立即清理，不长期保留备份副本。OAuth 刷新令牌使用 AES-256-GCM 加密后写入数据库，授权范围限制为应用自己创建的 Drive 文件。

在 Google Cloud 启用 Drive API、创建 Web OAuth 客户端后配置：

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://你的域名/api/backups/google/callback
BACKUP_ENCRYPTION_KEY=至少32位随机字符串
```

Google OAuth 应用处于测试状态时，需要在“Google Auth Platform → 受众群体 → 测试用户”中加入用于备份的 Google 账号。

从 Google Drive 下载备份包到服务器后，可执行下面命令恢复。它会先停止服务、恢复数据库，再替换业务文件；恢复前的产品/报价/导入/公司文件会保留在数据目录的 `restore-previous-时间` 文件夹。

```bash
cd /opt/QuoteFlow
chmod +x scripts/restore.sh
CONFIRM_RESTORE=RESTORE ./scripts/restore.sh /root/QuoteFlow-latest-backup.tar.gz
```

清空测试业务数据也只能显式执行，保留账号、公司资料和 Google Drive 绑定：

```bash
CONFIRM_CLEAR_BUSINESS=DELETE_BUSINESS_DATA pnpm storage:clear-business
```

请同时妥善保存生产环境的 `.env.production`；丢失其中的密钥可能导致 Google Drive 重新授权。

## 数据目录

```text
/data/quoteflow/
├── postgres/   # PostgreSQL 数据目录
├── products/   # 产品原图和缩略图
├── quotes/     # 正式报价 PNG 与 PDF
├── imports/    # 导入过程文件
├── company/    # 公司 Logo 等文件
├── caddy-data/
└── caddy-config/
```

## 质量检查

```bash
pnpm lint
pnpm test
pnpm build
```

测试覆盖金额精度、报价版本与锁定、产品导入、可选字段验证、Google Drive 令牌加密等核心逻辑。导出版式、浏览器兼容性与完整恢复流程应在每次上线前进行一次人工演练。

## 安全说明

- 不要提交 `.env`、`.env.production`、数据库文件或真实产品图片。
- 上线后立即修改种子账号密码。
- `BACKUP_ENCRYPTION_KEY` 丢失后无法解密已保存的 Google OAuth 刷新令牌。
- 云端备份不能替代对部署配置和密钥的安全保管。
