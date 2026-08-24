#!/usr/bin/env bash
# Wrapper MCP — carrega secrets Supabase sem expor keys no mcp.json
set -euo pipefail

SECRETS="${HUB_AGENT_SECRETS_DIR:-/opt/hub-agent/secrets}/supabase.env"
REPO="${HUB_AGENT_REPO_ROOT:-/opt/hub-agent/repo}"
SERVER="$REPO/scripts/hub-agent/mcp/hub-page-tools-server.js"

if [[ -f "$SECRETS" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS"
  set +a
fi

exec node "$SERVER"
