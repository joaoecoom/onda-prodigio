#!/usr/bin/env bash
# Sincroniza código Fase 3C para a VPS Contabo (WhatsApp / Evolution — NÃO Taskforce).
# Uso local: ./scripts/hub-agent/deploy-worker-vps.sh
set -euo pipefail

VPS_HOST="${HUB_VPS_HOST:-root@169.58.161.136}"
REPO_REMOTE="${HUB_VPS_REPO_PATH:-/opt/hub-agent/repo}"
WORKER_SERVICE="${HUB_WORKER_SERVICE:-hub-agent-worker.service}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== Deploy HUB Agent worker (Fase 3C) ==="
echo "Host: $VPS_HOST"
echo "Repo path: $REPO_REMOTE"

ssh "$VPS_HOST" "mkdir -p '$REPO_REMOTE' /opt/hub-agent/workspaces /opt/hub-agent/logs /opt/hub-agent/mcp"

rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude '.env*' \
  --exclude funnel \
  --exclude checkout9 \
  "$ROOT/lib/hub/" "$VPS_HOST:$REPO_REMOTE/lib/hub/"

rsync -avz \
  "$ROOT/scripts/hub-agent/" "$VPS_HOST:$REPO_REMOTE/scripts/hub-agent/"

rsync -avz \
  "$ROOT/lib/supabase-admin.js" "$VPS_HOST:$REPO_REMOTE/lib/supabase-admin.js"

ssh "$VPS_HOST" bash <<REMOTE
set -euo pipefail
export HUB_AGENT_REPO_ROOT="$REPO_REMOTE"

# Worker script (polling)
install -m 755 "$REPO_REMOTE/scripts/hub-agent/worker/poll-tasks.js" /opt/hub-agent/worker/poll-tasks.js
install -m 755 "$REPO_REMOTE/scripts/hub-agent/worker/offer-context-client.js" /opt/hub-agent/worker/offer-context-client.js
mkdir -p /opt/hub-agent/mcp
install -m 755 "$REPO_REMOTE/scripts/hub-agent/mcp/run-hub-page-tools.sh" /opt/hub-agent/mcp/run-hub-page-tools.sh
install -m 755 "$REPO_REMOTE/scripts/hub-agent/mcp/hub-page-tools-server.js" /opt/hub-agent/mcp/hub-page-tools-server.js

ENV_FILE="/opt/hub-agent/config/worker.env"
touch "\$ENV_FILE"
grep -q '^HUB_AGENT_REPO_ROOT=' "\$ENV_FILE" && sed -i "s|^HUB_AGENT_REPO_ROOT=.*|HUB_AGENT_REPO_ROOT=$REPO_REMOTE|" "\$ENV_FILE" || echo "HUB_AGENT_REPO_ROOT=$REPO_REMOTE" >> "\$ENV_FILE"
grep -q '^HUB_AGENT_REQUIRE_MCP=' "\$ENV_FILE" && sed -i 's|^HUB_AGENT_REQUIRE_MCP=.*|HUB_AGENT_REQUIRE_MCP=1|' "\$ENV_FILE" || echo "HUB_AGENT_REQUIRE_MCP=1" >> "\$ENV_FILE"

# Install deps if package.json exists
if [ -f "$REPO_REMOTE/package.json" ]; then
  cd "$REPO_REMOTE" && npm install --omit=dev 2>/dev/null || true
fi

systemctl daemon-reload
systemctl restart "$WORKER_SERVICE"
systemctl is-active "$WORKER_SERVICE"
echo "Worker restarted."
REMOTE

echo "Done. Verifica: ssh $VPS_HOST systemctl status $WORKER_SERVICE"
