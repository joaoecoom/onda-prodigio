#!/usr/bin/env bash
# Completa o login Google do gtm-mcp (Stape) uma vez.
# Uso: ./scripts/setup-gtm-mcp-oauth.sh
set -euo pipefail

echo "A limpar OAuth incompleto do gtm-mcp…"
pkill -f "mcp-remote.*gtm-mcp.stape.ai" 2>/dev/null || true
rm -f ~/.mcp-auth/mcp-remote-0.1.37/*_lock.json 2>/dev/null || true

echo ""
echo "Vai abrir o browser Google. IMPORTANTE:"
echo "  1) Escolhe a conta João Ecoom (geral.joaoecoom@gmail.com)"
echo "  2) Clica Autorizar / Continuar em TUDO"
echo "  3) NÃO feches o browser até voltar sozinho ao Cursor"
echo ""
echo "A iniciar gtm-mcp… (Ctrl+C quando disser Connected ou após login concluído)"
echo ""

npx -y mcp-remote "https://gtm-mcp.stape.ai/mcp"
