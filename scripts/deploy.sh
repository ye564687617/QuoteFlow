#!/bin/sh
set -eu

project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$project_dir"

if ! command -v docker >/dev/null 2>&1; then
  echo "未找到 Docker。请先安装 Docker Engine 和 Docker Compose 插件。" >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "未找到 docker compose 插件。" >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "未找到 openssl，无法生成部署密钥。" >&2
  exit 1
fi

env_file=".env.production"
first_deploy=0
if [ ! -f "$env_file" ]; then
  first_deploy=1
  site_address="${1:-:80}"
  admin_password="$(openssl rand -hex 12)"
  salesperson_password="$(openssl rand -hex 12)"
  umask 077
  {
    echo "SITE_ADDRESS=${site_address}"
    echo "DATA_ROOT=${DATA_ROOT:-/data/quoteflow}"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "SESSION_SECRET=$(openssl rand -hex 32)"
    echo "EXPORT_RENDER_TOKEN=$(openssl rand -hex 32)"
    echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}"
    echo "GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}"
    if [ -n "${GOOGLE_OAUTH_REDIRECT_URI:-}" ]; then
      echo "GOOGLE_OAUTH_REDIRECT_URI=${GOOGLE_OAUTH_REDIRECT_URI}"
    else
      case "$site_address" in
        :80) echo "GOOGLE_OAUTH_REDIRECT_URI=" ;;
        http://*|https://*) echo "GOOGLE_OAUTH_REDIRECT_URI=${site_address%/}/api/backups/google/callback" ;;
        *) echo "GOOGLE_OAUTH_REDIRECT_URI=https://${site_address%/}/api/backups/google/callback" ;;
      esac
    fi
    echo "INITIAL_ADMIN_EMAIL=admin@quoteflow.local"
    echo "INITIAL_ADMIN_PASSWORD=${admin_password}"
    echo "INITIAL_ADMIN_NAME=系统管理员"
    echo "INITIAL_SALESPERSON_EMAIL=mandy@quoteflow.local"
    echo "INITIAL_SALESPERSON_PASSWORD=${salesperson_password}"
    echo "INITIAL_SALESPERSON_NAME=Mandy zang"
  } > "$env_file"
  echo "已生成 ${env_file}。初始密码保存在该文件中，请妥善保管。"
fi

if ! grep -q '^BACKUP_ENCRYPTION_KEY=' "$env_file"; then echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> "$env_file"; fi
if ! grep -q '^GOOGLE_CLIENT_ID=' "$env_file"; then echo "GOOGLE_CLIENT_ID=" >> "$env_file"; fi
if ! grep -q '^GOOGLE_CLIENT_SECRET=' "$env_file"; then echo "GOOGLE_CLIENT_SECRET=" >> "$env_file"; fi
if ! grep -q '^GOOGLE_OAUTH_REDIRECT_URI=' "$env_file"; then
  current_site="$(sed -n 's/^SITE_ADDRESS=//p' "$env_file" | tail -1)"
  case "$current_site" in
    :80) redirect_uri="" ;;
    http://*|https://*) redirect_uri="${current_site%/}/api/backups/google/callback" ;;
    *) redirect_uri="https://${current_site%/}/api/backups/google/callback" ;;
  esac
  echo "GOOGLE_OAUTH_REDIRECT_URI=${redirect_uri}" >> "$env_file"
fi

data_root="$(sed -n 's/^DATA_ROOT=//p' "$env_file" | tail -1)"
if [ -z "$data_root" ]; then
  echo "${env_file} 缺少 DATA_ROOT。" >&2
  exit 1
fi

create_directories() {
  mkdir -p \
    "$data_root/postgres" "$data_root/products" "$data_root/quotes" \
    "$data_root/imports" "$data_root/company" "$data_root/caddy-data" \
    "$data_root/caddy-config"
}

if ! create_directories 2>/dev/null; then
  if command -v sudo >/dev/null 2>&1; then
    sudo mkdir -p \
      "$data_root/postgres" "$data_root/products" "$data_root/quotes" \
      "$data_root/imports" "$data_root/company" "$data_root/caddy-data" \
      "$data_root/caddy-config"
    sudo chown -R "$(id -u):$(id -g)" "$data_root"
  else
    echo "无法创建持久化目录，请使用有权限的账号运行。" >&2
    exit 1
  fi
fi

compose="docker compose --env-file ${env_file} -f compose.production.yml"

echo "[1/5] 构建应用镜像"
$compose build
echo "[2/5] 启动数据库"
$compose up -d postgres
echo "[3/5] 执行数据库迁移和首次初始化"
$compose run --rm migrate
echo "[4/5] 启动 Web、导出 Worker 和 HTTPS"
$compose up -d app worker caddy --remove-orphans
echo "[5/5] 检查服务状态"
$compose ps

site_address="$(sed -n 's/^SITE_ADDRESS=//p' "$env_file" | tail -1)"
case "$site_address" in
  :80) public_url="http://服务器IP" ;;
  http://*|https://*) public_url="$site_address" ;;
  *) public_url="https://$site_address" ;;
esac

echo "部署完成：${public_url}"
if [ "$first_deploy" -eq 1 ]; then
  echo "管理员账号：$(sed -n 's/^INITIAL_ADMIN_EMAIL=//p' "$env_file" | tail -1)"
  echo "管理员初始密码：$(sed -n 's/^INITIAL_ADMIN_PASSWORD=//p' "$env_file" | tail -1)"
  echo "首次登录后请立即修改密码。"
else
  echo "升级完成，现有账号、密码和业务数据保持不变。"
fi
