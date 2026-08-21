#!/usr/bin/env bash
# Aplica uma migration SQL ao Supabase da Angela (Onda Prodígio).
# Usa o PAT em .cursor/mcp.json → supabase-onda-prodigio (NÃO o OAuth user-supabase).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MCP_JSON="$ROOT/.cursor/mcp.json"
PROJECT_REF="vmyezkbkthguojmxhacw"

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 supabase/migrations/054_comments_social_ai.sql" >&2
  exit 1
fi

MIGRATION_PATH="$1"
if [[ ! -f "$MIGRATION_PATH" ]]; then
  MIGRATION_PATH="$ROOT/$1"
fi
if [[ ! -f "$MIGRATION_PATH" ]]; then
  echo "Ficheiro não encontrado: $1" >&2
  exit 1
fi

if [[ ! -f "$MCP_JSON" ]]; then
  echo "Em falta $MCP_JSON (copia de .cursor/mcp.json.example com PAT da Angela)." >&2
  exit 1
fi

TOKEN="$(python3 - <<'PY'
import json, pathlib, sys
cfg = json.loads(pathlib.Path(".cursor/mcp.json").read_text())
auth = cfg["mcpServers"]["supabase-onda-prodigio"]["headers"]["Authorization"]
print(auth.replace("Bearer ", "").strip())
PY
)"

PAYLOAD="$(python3 - <<PY
import json, pathlib
sql = pathlib.Path("$MIGRATION_PATH").read_text()
print(json.dumps({"query": sql}))
PY
)"

echo "A aplicar $(basename "$MIGRATION_PATH") em ${PROJECT_REF}..."
curl -fsS -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
echo
echo "OK."
