#!/bin/bash
set -euo pipefail

LOG_FILE="/var/log/whatsapp-failed-payment-campaign.log"
API_URL="https://onda-prodigio.vercel.app/api/sales-attribution?action=admin_send_next_failed_payment_whatsapp"
AUTH_TOKEN="${METRICS_DASHBOARD_PASSWORD:-Casca2020}"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

{
  echo "[$(timestamp)] failed-payment cron start"
  curl -sS -X POST "$API_URL" -H "Authorization: Bearer $AUTH_TOKEN"
  echo
  echo "[$(timestamp)] failed-payment cron end"
} >> "$LOG_FILE" 2>&1
