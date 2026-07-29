#!/bin/sh
set -eu

# Restores a backup created by QuoteFlow. It deliberately requires an explicit
# confirmation because it replaces the live database and business files.
archive_path=${1:-}
if [ -z "$archive_path" ] || [ ! -f "$archive_path" ]; then
  echo "用法：CONFIRM_RESTORE=RESTORE ./scripts/restore.sh /path/QuoteFlow-latest-backup.tar.gz" >&2
  exit 1
fi
if [ "${CONFIRM_RESTORE:-}" != "RESTORE" ]; then
  echo "此操作会覆盖当前数据库、产品、报价、导入和公司文件。请设置 CONFIRM_RESTORE=RESTORE 后重试。" >&2
  exit 1
fi
if [ ! -f .env.production ]; then
  echo "当前目录缺少 .env.production。请在 QuoteFlow 项目目录执行。" >&2
  exit 1
fi

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
data_root=$(sed -n 's/^DATA_ROOT=//p' .env.production | tail -1)
if [ -z "$data_root" ] || [ "$data_root" = "/" ]; then
  echo "DATA_ROOT 无效。" >&2
  exit 1
fi

stage=$(mktemp -d)
cleanup() { rm -rf "$stage"; }
trap cleanup 0 INT TERM

entries=$(tar -tzf "$archive_path")
if ! printf '%s\n' "$entries" | grep -qxE '\.?/?database\.dump' || ! printf '%s\n' "$entries" | grep -qxE '\.?/?manifest\.json'; then
  echo "备份包不包含有效的 QuoteFlow 数据库转储。" >&2
  exit 1
fi
if printf '%s\n' "$entries" | grep -Ev '^(\.?/?(database\.dump|manifest\.json|(products|quotes|imports|company|postgres|caddy-data|caddy-config)(/.*)?))$' | grep -q .; then
  echo "备份包包含不允许恢复的文件。" >&2
  exit 1
fi
tar -xzf "$archive_path" -C "$stage"

compose() { docker compose --env-file .env.production -f compose.production.yml "$@"; }
echo "停止 Web、导出 Worker 和 HTTPS 服务"
compose stop app worker caddy
echo "启动数据库并恢复 PostgreSQL"
compose up -d postgres
until compose exec -T postgres pg_isready -U quoteflow -d quoteflow >/dev/null 2>&1; do sleep 2; done
cat "$stage/database.dump" | compose exec -T postgres pg_restore -U quoteflow -d quoteflow --clean --if-exists --no-owner
echo "将数据库升级到当前程序版本"
compose run --rm migrate

previous_dir="$data_root/restore-previous-$(date +%Y%m%d%H%M%S)"
mkdir -p "$previous_dir"
for name in products quotes imports company; do
  target="$data_root/$name"
  restored="$stage/$name"
  if [ -e "$target" ]; then mv "$target" "$previous_dir/$name"; fi
  if [ -d "$restored" ]; then mv "$restored" "$target"; else mkdir -p "$target"; fi
done

echo "启动 QuoteFlow 服务"
compose up -d app worker caddy
echo "恢复完成。恢复前的业务文件保留在：$previous_dir"
