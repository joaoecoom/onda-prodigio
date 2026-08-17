#!/usr/bin/env bash
# Reinicia o Stape MCP com a API key correcta (EU).
# Uso: ./scripts/fix-stape-mcp.sh
set -euo pipefail

KEY="${STAPE_API_KEY:-2c71065f4e228f606e0e9c0f4a0450c57e9a256a}"

echo "A parar processos Stape MCP antigos…"
pkill -f "mcp-remote.*mcp.stape.ai/mcp" 2>/dev/null || true
sleep 1

echo "A testar API key (REST)…"
code=$(curl -sS -o /dev/null -w "%{http_code}" -H "X-AUTH-TOKEN: $KEY" "https://api.app.stape.io/api/v2/account")
if [ "$code" != "200" ]; then
  echo "ERRO: API key inválida (HTTP $code). Gera uma nova em app.stape.io → Account → API keys."
  exit 1
fi
echo "API key OK (HTTP 200)."

echo ""
echo "Nota: não usar X-Stape-Region: EU — a API key funciona em api.app.stape.io,"
echo "mas api.app.eu.stape.io devolve 401 (limitação Stape MCP)."
echo ""
echo "Próximo passo no Cursor:"
echo "  1) Cmd+Shift+P → Reload Window"
echo "  2) Cmd+Shift+J → MCP → confirma stape-eu e gtm-mcp verdes"
echo ""
