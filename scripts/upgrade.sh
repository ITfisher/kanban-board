#!/usr/bin/env sh
# upgrade.sh — 升级脚本：停止旧容器 → 拉取最新代码 → 重新构建 → 启动
# 数据安全：仅使用命名卷 kanban_data，升级过程中绝不使用 down -v
#
# 用法：
#   ./scripts/upgrade.sh          # 普通升级（利用 Docker 层缓存，速度快）
#   ./scripts/upgrade.sh --force  # 强制全量重建（依赖变化或排查问题时使用）
set -eu

CONTAINER_NAME="kanban-board"
COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"
FORCE_REBUILD=0

# 解析参数
for arg in "$@"; do
  case "$arg" in
    --force) FORCE_REBUILD=1 ;;
  esac
done

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# ── 1. 检查 Docker 是否可用 ────────────────────────────────────────────────
if ! docker info > /dev/null 2>&1; then
  log "错误：Docker 未运行或当前用户无权限访问 Docker"
  exit 1
fi

# ── 2. 启用 BuildKit（加速构建） ───────────────────────────────────────────
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# ── 3. 检查容器是否存在并停止 ──────────────────────────────────────────────
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "检测到容器 ${CONTAINER_NAME} 正在运行，正在停止..."
    docker compose -f "$COMPOSE_FILE" stop
    log "容器已停止"
  else
    log "检测到容器 ${CONTAINER_NAME} 已存在但未运行"
  fi
else
  log "容器 ${CONTAINER_NAME} 不存在，将进行首次部署"
fi

# ── 4. 拉取最新代码 ────────────────────────────────────────────────────────
log "拉取最新代码..."
git -C "$(dirname "$0")/.." pull --ff-only
log "代码已更新"

# ── 5. 构建镜像 ────────────────────────────────────────────────────────────
if [ "$FORCE_REBUILD" = "1" ]; then
  log "强制全量重建镜像（--no-cache）..."
  docker compose -f "$COMPOSE_FILE" build --no-cache
else
  log "构建镜像（利用层缓存，依赖未变时跳过 pnpm install）..."
  docker compose -f "$COMPOSE_FILE" build
fi
log "镜像构建完成"

# ── 6. 启动容器（保留数据卷，绝不使用 down -v）────────────────────────────
log "启动容器..."
docker compose -f "$COMPOSE_FILE" up -d
log "容器已启动"

# ── 7. 确认运行状态 ────────────────────────────────────────────────────────
sleep 2
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log "升级成功！容器 ${CONTAINER_NAME} 正在运行"
  docker ps --filter "name=${CONTAINER_NAME}" --format "  状态: {{.Status}}  端口: {{.Ports}}"
else
  log "警告：容器未能正常启动，请检查日志："
  log "  docker logs ${CONTAINER_NAME}"
  exit 1
fi

log "数据卷 kanban_data 已保留，数据未受影响"
