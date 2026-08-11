#!/usr/bin/env python3
import csv
import json
import subprocess
import sys

CSV_PATH = sys.argv[1] if len(sys.argv) > 1 else "/Volumes/Remote Nrl /Downloads MAC/unified_payments (1).csv"
MCP_PATH = "/Volumes/Remote Nrl /Cursor/Projetos/Onda Prodigio/.cursor/mcp.json"
PROJECT = "vmyezkbkthguojmxhacw"

token = json.load(open(MCP_PATH))["mcpServers"]["supabase-onda-prodigio"]["headers"]["Authorization"].replace("Bearer ", "")

rows = {}
with open(CSV_PATH, newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        email = (row.get("email (metadata)") or row.get("Customer Email") or "").strip().lower()
        phone = (row.get("phone (metadata)") or "").strip()
        country = (row.get("phone_country (metadata)") or row.get("country (metadata)") or "PT").strip().upper()
        purchase_ref = (row.get("purchase_event_id (metadata)") or "").strip()
        pi = ""
        if purchase_ref.startswith("purchase_pi_"):
            pi = purchase_ref.replace("purchase_", "")
        if email and phone:
            rows[email] = {"phone": phone, "country": country, "pi": pi}

updated = 0
for email, data in rows.items():
    phone_esc = data["phone"].replace("'", "''")
    country_esc = data["country"].replace("'", "''")
    email_esc = email.replace("'", "''")
    sql = (
        f"UPDATE members SET phone = '{phone_esc}', phone_country = '{country_esc}', updated_at = now() "
        f"WHERE lower(email) = lower('{email_esc}');"
    )
    payload = json.dumps({"query": sql})
    result = subprocess.run(
        [
            "curl", "-sS", "-X", "POST",
            f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
            "-H", f"Authorization: Bearer {token}",
            "-H", "Content-Type: application/json",
            "-d", payload,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("FAIL", email, result.stderr)
        continue
    updated += 1
    if data["pi"]:
        pi_esc = data["pi"].replace("'", "''")
        sql2 = (
            f"UPDATE member_products SET stripe_payment_intent_id = '{pi_esc}' "
            f"WHERE member_id = (SELECT id FROM members WHERE lower(email) = lower('{email_esc}') LIMIT 1) "
            f"AND stripe_payment_intent_id IS NULL;"
        )
        subprocess.run(
            [
                "curl", "-sS", "-X", "POST",
                f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
                "-H", f"Authorization: Bearer {token}",
                "-H", "Content-Type: application/json",
                "-d", json.dumps({"query": sql2}),
            ],
            capture_output=True,
            text=True,
        )

print(f"updated_members={updated} from_csv={len(rows)}")
