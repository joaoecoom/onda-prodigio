# Fase 1 — AI Task Infrastructure (Relatório)

**Data:** 18 Agosto 2026  
**Estado:** ✅ Concluída — critérios de sucesso cumpridos  
**Projecto Supabase:** `vmyezkbkthguojmxhacw`  
**VPS Worker:** `169.58.161.136` (Contabo WhatsApp / Evolution API)  
**HUB:** `https://hub-dr-ecoom.vercel.app`

---

## 1. Arquitectura implementada

```text
┌───────────────────────────────┐
│          HUB DR ECOOM         │
│            Vercel             │
│                               │
│  UI: módulo AI Agent          │
│  API: hub_ai_task_*           │
│          │                    │
│          ▼                    │
│     INSERT ai_tasks           │
│     (status: pending)         │
└──────────┬────────────────────┘
           │
           │ Supabase (RLS, service role)
           ▼
┌───────────────────────────────┐
│         CONTABO VPS           │
│  systemd: hub-agent-worker    │
│                               │
│  poll-tasks.js (5s)           │
│    → claim_next_ai_task RPC   │
│    → Cursor Agent CLI         │
│    → logs em /opt/hub-agent/  │
│    → PATCH ai_tasks           │
└──────────┬────────────────────┘
           │
           ▼
     HUB polling GET task
```

**Princípio de segurança:** o Cursor Agent **não** está exposto à internet. A VPS **não** abre portas novas — faz polling outbound para Supabase.

---

## 2. Ficheiros criados / alterados

### Base de dados
| Ficheiro | Descrição |
|----------|-----------|
| `supabase/migrations/063_ai_tasks.sql` | Tabela `ai_tasks` + RPC `claim_next_ai_task` |

### Backend HUB
| Ficheiro | Descrição |
|----------|-----------|
| `lib/hub/ai-tasks.js` | CRUD tasks, validação prompt, workspace fixo |
| `lib/hub/handlers/ai-tasks.js` | Handlers API autenticados |
| `lib/hub/module-data.js` | Dados módulo `ai-agent` + tasks recentes |
| `lib/hub/modules.js` | Registo módulo AI Agent |
| `api/sales-attribution.js` | Rotas `hub_ai_task_create`, `hub_ai_task`, `hub_ai_tasks` |

### Frontend HUB
| Ficheiro | Descrição |
|----------|-----------|
| `hub/hub-ai.js` | UI form, polling, detalhe, logs |
| `hub/hub.js` | Integração módulo `ai-agent` |
| `hub/hub.css` | Estilos AI Agent |
| `hub/index.html` | Script `hub-ai.js` |
| `vercel.json` | Rewrite `/ai-agent` → hub |

### Worker VPS (repo + deploy)
| Ficheiro | Descrição |
|----------|-----------|
| `scripts/hub-agent/worker/poll-tasks.js` | Worker polling + execução Agent |
| `scripts/hub-agent/hub-agent-worker.service` | Unit systemd |
| `scripts/hub-agent/worker.env.example` | Config worker |
| `scripts/hub-agent/supabase.env.example` | Secrets Supabase (VPS) |
| `scripts/hub-agent/worker-health.sh` | Health check local |

### VPS (deploy directo, não versionado)
| Caminho | Descrição |
|---------|-----------|
| `/opt/hub-agent/worker/poll-tasks.js` | Worker activo |
| `/opt/hub-agent/config/worker.env` | Config |
| `/opt/hub-agent/secrets/supabase.env` | `SUPABASE_URL` + service role (chmod 600) |
| `/etc/systemd/system/hub-agent-worker.service` | Serviço systemd |

---

## 3. Migration — `ai_tasks`

**Tabela:** `ai_tasks`

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | UUID | PK |
| `created_at`, `updated_at` | timestamptz | |
| `status` | text | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `prompt` | text | Validado no HUB (8–12000 chars) |
| `offer_id` | text nullable | FK `hub_offers` — preparação multi-oferta |
| `task_type` | text | `general`, `analysis`, `content`, `code` |
| `workspace` | text | Fixo server-side |
| `branch` | text | `agent-proof-of-concept` |
| `requested_by` | text | |
| `worker_id` | text | Preenchido no claim |
| `started_at`, `completed_at`, `failed_at` | timestamptz | |
| `result` | jsonb | summary, files_changed, duration, etc. |
| `error` | text | |
| `exit_code` | int | |
| `logs_reference` | text | Path na VPS |
| `metadata` | jsonb | |

**RLS:** activado, sem policies públicas (acesso via service role).

**Claim atómico:** `claim_next_ai_task(p_worker_id)` com `FOR UPDATE SKIP LOCKED`.

---

## 4. APIs criadas

Todas autenticadas com `Authorization: Bearer` + `METRICS_DASHBOARD_PASSWORD` (mesmo auth do HUB).

| Método | Action | Comportamento |
|--------|--------|---------------|
| POST | `hub_ai_task_create` | Cria task `pending`, devolve `task_id` (não bloqueia) |
| GET | `hub_ai_task&id=` | Detalhe task (polling frontend) |
| GET | `hub_ai_tasks` | Lista recente (até 50) |

**Body exemplo (create):**
```json
{
  "prompt": "Cria uma página de teste",
  "offer_id": "...",
  "task_type": "general"
}
```

---

## 5. Worker Contabo

| Item | Valor |
|------|-------|
| Service | `hub-agent-worker.service` |
| Worker ID | `contabo-whatsapp-1` |
| Poll interval | 5000 ms |
| Workspace | `/opt/hub-agent/workspace/onda-prodigio` |
| Branch | `agent-proof-of-concept` |
| Agent auth | `agent login` (cli_login) — **sem** CURSOR_API_KEY |
| Logs | `/opt/hub-agent/logs/ai-task-{uuid}.*` |

**Fluxo por task:**
1. `claim_next_ai_task`
2. Valida workspace (apenas path autorizado)
3. `git checkout` branch de trabalho
4. `agent -p --trust --force --workspace ... "prompt"` (prompt como argumento, **nunca** shell)
5. Captura stdout/stderr/exit code
6. `git status --porcelain` → `files_changed`
7. Actualiza `ai_tasks` → `completed` ou `failed`

**Health check:**
```bash
bash /opt/hub-agent/worker-health.sh
```

---

## 6. UI HUB — AI Agent

Módulo **AI Agent** dentro de cada oferta:

- Formulário: prompt, oferta (opcional), tipo
- Botão **Executar** → POST create → polling 2.5s
- Estados visuais: 🟡 pending/running, 🟢 completed, 🔴 failed
- Painel detalhe: timestamps, duration, result, error, ficheiros
- Botão **Ver logs** (preview stdout/stderr da BD — logs completos na VPS)

---

## 7. Segurança

| Medida | Estado |
|--------|--------|
| Sem API pública na VPS | ✅ |
| Agent não exposto à internet | ✅ |
| Prompt nunca passa por `bash -c` | ✅ |
| Workspace definido server-side (API + worker) | ✅ |
| Sem force push / merge / deploy automático | ✅ |
| Sem CURSOR_API_KEY / OpenAI / Anthropic / Gemini | ✅ |
| Secrets Supabase só na VPS (chmod 600) | ✅ |
| RLS em `ai_tasks` | ✅ |
| Claim atómico (multi-worker safe) | ✅ |

---

## 8. Testes realizados

### 8.1 Teste end-to-end (sucesso)

**Task ID:** `6ee712d5-3f27-44bc-83b1-203221b45c9a`

**Prompt:** criar `AI-TASK-PROOF.md` na raiz do projecto.

| Verificação | Resultado |
|-------------|-----------|
| HUB → Supabase → worker → Agent | ✅ |
| Ficheiro criado na VPS | ✅ |
| Conteúdo correcto | ✅ |
| Status | `completed` |
| Exit code | `0` |
| Logs VPS | ✅ `/opt/hub-agent/logs/ai-task-6ee712d5-*` |
| Cursor Desktop | Não utilizado |

**Conteúdo do ficheiro:**
```
Esta alteração foi executada pelo Cursor Agent através do HUB DR Ecoom.
```

### 8.2 Teste API HUB (produção)

**Task ID:** `c28cb1b3-f971-4fc8-8f07-d53b4f5413de`

- POST `hub_ai_task_create` via `hub-dr-ecoom.vercel.app` → ✅ `pending`
- Worker claim + execução → ✅ `completed` exit 0

### 8.3 Teste de falha

**Task ID:** `6c8d0d16-2733-4ff2-ad03-c996d6a7025e`

- Workspace inválido (`/etc`) inserido directamente na BD (simula corrupção)
- Worker rejeitou: `Workspace não autorizado: /etc`
- Status → `failed`, exit code `1`
- Worker systemd → `active` após falha
- Tasks seguintes continuaram a funcionar

---

## 9. Limitações (Fase 1)

- **Polling** apenas (sem WebSockets)
- **Logs completos** só na VPS; HUB mostra preview truncado
- **Um worker** activo (`contabo-whatsapp-1`)
- **OfferContext** não implementado — `offer_id` guardado mas Agent não recebe contexto de oferta
- **Workspace único** (`onda-prodigio`) — multi-oferta runtime fica para fases posteriores
- **Sem cancel** de tasks em curso via UI
- **Deploy Vercel** feito; alterações locais devem ser commitadas/pushed pelo utilizador quando conveniente
- **Chave service role na VPS** — necessária para polling Supabase; recomendação futura: credencial dedicada ou proxy HUB↔worker

---

## 10. O que NÃO foi construído (conforme spec)

Funnel Builder, Page Builder, OfferContext completo, multi-offer runtime, Stripe/Meta multi-oferta, domínios automáticos, marketplace, billing, roles complexas, etc.

---

## 11. Próximos passos (Fase 2+ — não iniciada)

1. OfferContext — injectar dados da oferta no prompt do Agent
2. Multi-workspace por oferta
3. Cancelamento de tasks
4. Endpoint seguro HUB↔worker (alternativa à service role na VPS)
5. SSH key dedicada hub-agent (remover password auth)
6. UI: lista global de tasks, filtros, retry

---

## 12. Comandos úteis

**VPS — estado worker:**
```bash
systemctl status hub-agent-worker
bash /opt/hub-agent/worker-health.sh
tail -f /opt/hub-agent/logs/worker.log
```

**Criar task via API:**
```bash
curl -X POST 'https://hub-dr-ecoom.vercel.app/api/sales-attribution?action=hub_ai_task_create' \
  -H 'Authorization: Bearer $METRICS_DASHBOARD_PASSWORD' \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"...","task_type":"general"}'
```

**Consultar task:**
```bash
curl 'https://hub-dr-ecoom.vercel.app/api/sales-attribution?action=hub_ai_task&id=UUID' \
  -H 'Authorization: Bearer $METRICS_DASHBOARD_PASSWORD'
```

---

**Fase 1 concluída. PARAR aqui.**
