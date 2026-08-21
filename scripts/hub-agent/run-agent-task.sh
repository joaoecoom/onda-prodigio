#!/usr/bin/env bash
set -euo pipefail

# HUB DR Ecoom — Cursor Agent task runner (VPS worker)
# Deploy path on VPS: /opt/hub-agent/scripts/run-agent-task.sh
# Usage: run-agent-task.sh "Your prompt here"

if [ $# -lt 1 ]; then
  echo "Usage: $0 \"prompt\"" >&2
  exit 2
fi

PROMPT="$*"
BASE="/opt/hub-agent"
WORKSPACE="${HUB_AGENT_WORKSPACE:-$BASE/workspace/onda-prodigio}"
BRANCH="${HUB_AGENT_BRANCH:-agent-proof-of-concept}"
LOG_DIR="$BASE/logs"
TASK_ID="$(date +%Y%m%dT%H%M%S)-$$"
LOG_BASE="$LOG_DIR/task-$TASK_ID"
STDOUT_LOG="$LOG_BASE.stdout.log"
STDERR_LOG="$LOG_BASE.stderr.log"
META_LOG="$LOG_BASE.meta.log"

mkdir -p "$LOG_DIR"
export PATH="/root/.local/bin:$PATH"

# Optional API key (headless CI). CLI login also works without it.
if [ -f "$BASE/secrets/cursor.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$BASE/secrets/cursor.env"
  set +a
fi

AUTH_METHOD="none"
if [ -n "${CURSOR_API_KEY:-}" ]; then
  AUTH_METHOD="api_key"
else
  STATUS_OUT="$(agent status 2>&1 || true)"
  if echo "$STATUS_OUT" | grep -q "Logged in as"; then
    AUTH_METHOD="cli_login"
  fi
fi

if [ "$AUTH_METHOD" = "none" ]; then
  echo "ERROR: Not authenticated. Run 'NO_OPEN_BROWSER=1 agent login' or set CURSOR_API_KEY in $BASE/secrets/cursor.env" >&2
  exit 3
fi

if [ ! -d "$WORKSPACE/.git" ]; then
  echo "ERROR: workspace missing at $WORKSPACE" >&2
  exit 4
fi

cd "$WORKSPACE"

git fetch origin --quiet 2>/dev/null || true
git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH"

START_TS="$(date -Is)"
echo "task_id=$TASK_ID" > "$META_LOG"
echo "started_at=$START_TS" >> "$META_LOG"
echo "workspace=$WORKSPACE" >> "$META_LOG"
echo "branch=$BRANCH" >> "$META_LOG"
echo "auth_method=$AUTH_METHOD" >> "$META_LOG"
echo "prompt=$PROMPT" >> "$META_LOG"

set +e
agent -p --trust --force --workspace "$WORKSPACE" --output-format text "$PROMPT" \
  > >(tee "$STDOUT_LOG") \
  2> >(tee "$STDERR_LOG" >&2)
EXIT_CODE=$?
set -e

END_TS="$(date -Is)"
echo "finished_at=$END_TS" >> "$META_LOG"
echo "exit_code=$EXIT_CODE" >> "$META_LOG"

if [ -n "${CURSOR_API_KEY:-}" ]; then
  sed -i "s/${CURSOR_API_KEY}/[REDACTED]/g" "$STDOUT_LOG" "$STDERR_LOG" "$META_LOG" 2>/dev/null || true
fi

echo "Task $TASK_ID finished with exit $EXIT_CODE (auth: $AUTH_METHOD)"
echo "Logs: $LOG_BASE.*"
exit "$EXIT_CODE"
