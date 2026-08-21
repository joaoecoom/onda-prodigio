#!/usr/bin/env bash
# Health check local (VPS) — sem portas públicas
set -euo pipefail

BASE="/opt/hub-agent"
export PATH="/root/.local/bin:$PATH"

echo "=== HUB Agent Worker Health ==="
echo "time: $(date -Is)"
echo "worker_id: ${WORKER_ID:-contabo-whatsapp-1}"

if command -v agent >/dev/null 2>&1; then
  echo "cursor_cli: ok ($(agent --version 2>/dev/null || echo unknown))"
  agent status 2>&1 | head -3 || true
else
  echo "cursor_cli: MISSING"
fi

if [ -d "$BASE/workspaces/onda-prodigio/.git" ] || [ -L "$BASE/workspaces/onda-prodigio" ]; then
  echo "workspace: ok ($BASE/workspaces/onda-prodigio)"
elif [ -d "$BASE/workspace/onda-prodigio/.git" ]; then
  echo "workspace: ok legacy ($BASE/workspace/onda-prodigio)"
else
  echo "workspace: MISSING"
fi

if [ -d "$BASE/workspaces/ai-test-offer/.git" ]; then
  echo "ai_test_workspace: ok"
else
  echo "ai_test_workspace: missing"
fi

if systemctl is-active hub-agent-worker >/dev/null 2>&1; then
  echo "systemd: active"
else
  echo "systemd: inactive"
fi

if [ -f "$BASE/secrets/supabase.env" ]; then
  echo "supabase_env: present"
else
  echo "supabase_env: missing"
fi

if [ -f "$BASE/logs/worker.log" ]; then
  echo "last_worker_log:"
  tail -n 5 "$BASE/logs/worker.log" || true
fi
