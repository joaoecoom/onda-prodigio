#!/usr/bin/env bash
# Prepara workspaces multi-oferta na VPS Contabo (WhatsApp / Evolution API)
set -euo pipefail

BASE="/opt/hub-agent"
WORKSPACES="$BASE/workspaces"
LEGACY="$BASE/workspace"
BRANCH="${HUB_AGENT_BRANCH:-agent-proof-of-concept}"

mkdir -p "$WORKSPACES" "$BASE/logs"

setup_onda() {
  local target="$WORKSPACES/onda-prodigio"
  local legacy="$LEGACY/onda-prodigio"

  if [ -d "$legacy/.git" ] && [ ! -e "$target" ]; then
    ln -s "$legacy" "$target"
    echo "onda-prodigio: symlink $target -> $legacy"
  elif [ -d "$target/.git" ]; then
    echo "onda-prodigio: ok ($target)"
  else
    echo "onda-prodigio: MISSING — clone repo para $target ou $legacy"
    return 1
  fi
}

setup_ai_test() {
  local target="$WORKSPACES/ai-test-offer"

  if [ ! -d "$target" ]; then
    mkdir -p "$target"
    git -C "$target" init -b "$BRANCH"
    git -C "$target" config user.email "hub-agent@local"
    git -C "$target" config user.name "HUB Agent"
    echo "# AI Test Offer workspace" > "$target/README.md"
    git -C "$target" add README.md
    git -C "$target" commit -m "init ai-test-offer workspace"
    echo "ai-test-offer: created $target"
  else
    echo "ai-test-offer: ok ($target)"
  fi
}

echo "=== HUB Agent workspace setup ==="
setup_onda
setup_ai_test
echo "Done."
