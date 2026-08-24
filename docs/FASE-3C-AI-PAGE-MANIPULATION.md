# Fase 3C — AI Page Manipulation (Relatório)

**Data:** 18 Agosto 2026  
**Branch:** `phase-3c-ai-page-manipulation`  
**Estado:** ✅ Concluída (código + testes + fixture produção)  
**Projecto Supabase:** `vmyezkbkthguojmxhacw`

---

## 1. Objectivo

Dar ao **Cursor Agent** uma API interna estruturada para manipular o Page Engine:

```text
HUB AI Task → Worker → Cursor Agent CLI → HUB MCP Tools → Funnel Engine → Supabase → PageRenderer
```

Sem SQL livre, sem HTML gigante, sem alterações directas à BD pelo modelo.

---

## 2. Arquitectura

```text
                 HUB
                  │
                  ▼
              ai_tasks
                  │
                  ▼
          poll-tasks.js (VPS)
                  │
      ┌───────────┴────────────┐
      ▼                        ▼
  Agent prompt            .cursor/mcp.json
  (OfferContext)          hub-page-tools MCP
                                  │
                                  ▼
                         lib/hub/agent-tools/
                                  │
                                  ▼
                         lib/hub/funnel-engine/
                                  │
                                  ▼
                              Supabase
```

### Camada `lib/hub/agent-tools/`

| Ficheiro | Função |
|----------|--------|
| `errors.js` | Códigos estruturados (`CROSS_OFFER_ACCESS`, `INVALID_BLOCK_TYPE`, …) |
| `context.js` | Offer binding via `HUB_AGENT_OFFER_ID` |
| `registry.js` | Allowlist de 20 tools + JSON schemas |
| `executor.js` | Executa tools via funnel-engine service |
| `logger.js` | Observabilidade (`ai_task_tool_calls` ou JSONL fallback) |
| `index.js` | Exports |

### MCP Server privado

`scripts/hub-agent/mcp/hub-page-tools-server.js`

- Stdio JSON-RPC (MCP tools/list + tools/call)
- **Não** expõe SQL, shell, nem tools genéricas
- `HUB_AGENT_OFFER_ID` obrigatório (definido pelo worker)

### Worker (integração)

`scripts/hub-agent/worker/poll-tasks.js`:

- Escreve `.cursor/mcp.json` no workspace antes de cada task
- Injecta `HUB_AGENT_OFFER_ID` + `HUB_AGENT_TASK_ID` no env do Agent
- Prompt actualizado com regras do Page Engine

---

## 3. Tools implementadas (20)

### Funnels
- `get_funnel`, `list_funnels`, `create_funnel`, `update_funnel`

### Pages
- `get_page`, `list_pages`, `create_page`, `update_page`, `duplicate_page`

### Sections
- `list_sections`, `create_section`, `update_section`, `delete_section`, `reorder_sections`

### Blocks
- `list_blocks`, `create_block`, `update_block`, `delete_block`, `reorder_blocks`

### Tree
- `get_page_tree`

**Não implementado (fases posteriores):** publish, deploy, domain, checkout, quiz, analytics.

---

## 4. Segurança

| Controlo | Implementação |
|----------|---------------|
| Allowlist | Apenas 20 tools registadas |
| Offer binding | `HUB_AGENT_OFFER_ID` env + validação `offer_id` input |
| Cross-offer | `CROSS_OFFER_ACCESS` se offer_id ≠ bound |
| Block types | Enum Fase 3A — `INVALID_BLOCK_TYPE` |
| Secrets | Não enviados ao Agent |
| SQL/Shell | Sem tools genéricas |
| Slug dup | `DUPLICATE_SLUG` (service + Postgres) |
| Observabilidade | `ai_task_tool_calls` (sem secrets nos logs) |

---

## 5. Domain layer reutilizado

Todas as tools chamam `lib/hub/funnel-engine/service.js` — mesma lógica que UI/API futura.

Adicionado na Fase 3C:
- `listSections`, `listBlocks`, `duplicatePage`
- `validateBlockPayload(input, isUpdate)` para updates parciais
- Verificação de slug duplicado em `createFunnel` / `createPage`

---

## 6. Migration

| Ficheiro | Descrição |
|----------|-----------|
| `066_ai_task_tool_calls.sql` | Log de tool calls por task/offer |

**Aplicada:** ✅ `vmyezkbkthguojmxhacw`

---

## 7. Ficheiros criados

```
lib/hub/agent-tools/
  context.js, errors.js, executor.js, index.js, logger.js, registry.js
scripts/hub-agent/mcp/
  hub-page-tools-server.js
  mcp.json.template
supabase/migrations/066_ai_task_tool_calls.sql
tests/agent-tools.test.js
docs/FASE-3C-AI-PAGE-MANIPULATION.md
```

## 8. Ficheiros alterados

```
lib/hub/funnel-engine/service.js
lib/hub/funnel-engine/validation.js
scripts/hub-agent/worker/poll-tasks.js
scripts/hub-agent/worker/offer-context-client.js
```

---

## 9. Testes

```bash
npm test
```

**Resultado:** 65 testes, 65 pass

- 51 testes Fases 2 + 3A + 3B intactos
- 14 testes novos agent-tools

Cobertura: create/update/delete, reorder, get_page_tree, cross-offer, invalid block, duplicate slug, unknown tool, duplicate page, full page structure.

---

## 10. Fixture produção (primeiro create)

Criada via agent tools em **AI Test Offer**:

| Entidade | Slug |
|----------|------|
| Funnel | `ai-generated-funnel` |
| Page | `ai-generated-sales-page` |

Estrutura: Hero (heading/text/button) + Benefits (heading/text) + CTA (heading/button) = 3 sections, 7 blocks.

**Preview:**

https://hub-dr-ecoom.vercel.app/preview/ai-test-offer/ai-generated-funnel/ai-generated-sales-page

---

## 11. Testes E2E executados

| Teste | Resultado |
|-------|-----------|
| Create (AI Generated page) | ✅ 3 sections, 7 blocks |
| Update hero heading | ✅ `Transforma a tua rotina com um novo método.` |
| Add benefits text block | ✅ 3 blocks em Benefits |
| Cross-offer (`CROSS_OFFER_ACCESS`) | ✅ |
| Invalid block (`INVALID_BLOCK_TYPE`) | ✅ |
| Preview pós-update | ✅ HTTP 200, heading visível |
| MCP server `tools/list` | ✅ 20 tools |

**Preview actualizado:**

https://hub-dr-ecoom.vercel.app/preview/ai-test-offer/ai-generated-funnel/ai-generated-sales-page

### VPS (requer SSH)

Script criado: `./scripts/hub-agent/deploy-worker-vps.sh`

```bash
./scripts/hub-agent/deploy-worker-vps.sh
```

Requer acesso SSH a `root@169.58.161.136`.

Após deploy VPS:

1. `HUB_AGENT_REPO_ROOT=/opt/hub-agent/repo` em `worker.env`
2. `HUB_AGENT_REQUIRE_MCP=1` em `worker.env` (task falha se MCP não for usado)
3. `systemctl restart hub-agent-worker`
4. Criar task no HUB → Agent usa MCP `hub-page-tools` automaticamente

---

## 12. Validação MCP (18 Agosto 2026) — ✅ CONCLUÍDA

### Causa raiz do problema anterior

| Problema | Correção |
|----------|----------|
| MCP `hub-page-tools` não aprovado | `--approve-mcps` no `runAgent()` + `agent mcp enable hub-page-tools` |
| `mcp.json` com secrets em plaintext | Wrapper `run-hub-page-tools.sh` carrega `/opt/hub-agent/secrets/supabase.env` |
| Path MCP quebrado (`/opt/hub-agent/mcp/…`) | Server corre via `HUB_AGENT_REPO_ROOT/scripts/hub-agent/mcp/` |
| Fallback mascarava falha MCP | `HUB_AGENT_REQUIRE_MCP=1` — task falha sem tool calls registadas |
| Logs MCP no stdout | Logs vão para stderr; stdout = protocolo JSON-RPC apenas |

### Cursor CLI (VPS)

| Item | Valor |
|------|-------|
| Versão | `2026.08.11-e8db854` |
| Comando Agent | `agent -p --trust --force --approve-mcps --workspace <ws> --output-format text "<prompt>"` |
| Aprovação MCP | `--approve-mcps` (headless) + `agent mcp enable hub-page-tools` (persistente) |
| MCP status | `agent mcp list` → `hub-page-tools: ready` |

### Configuração MCP utilizada

Workspace: `/opt/hub-agent/workspaces/ai-test-offer/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "hub-page-tools": {
      "command": "bash",
      "args": ["/opt/hub-agent/repo/scripts/hub-agent/mcp/run-hub-page-tools.sh"],
      "env": {
        "HUB_AGENT_OFFER_ID": "ai-test-offer",
        "HUB_AGENT_TASK_ID": "<task-id>",
        "HUB_AGENT_REPO_ROOT": "/opt/hub-agent/repo"
      }
    }
  }
}
```

Secrets Supabase **não** estão no `mcp.json` — carregados pelo wrapper.

### MCP server (isolado)

- Processo inicia via stdio
- 20 tools expostas (`tools/list`)
- Logs em stderr: `hub-page-tools MCP server starting…` e `[hub-page-tools] tool_call …`

### Teste directo Agent (fora do worker)

Prompt: `get_page_tree` para `agent-e2e-funnel` / `agent-e2e-sales-page`

| Evidência | Resultado |
|-----------|-----------|
| MCP loaded | ✅ `hub-page-tools: ready` |
| Tool chamada | ✅ `get_page_tree` |
| Estrutura devolvida | ✅ 3 sections (hero, benefits, cta), 7 blocks |
| Sem modificação | ✅ read-only |

### Teste escrita via worker E2E

Task: `dc3171b5-f847-46cd-abc3-ad961b7d592e`

| Evidência | Resultado |
|-----------|-----------|
| Worker claim | ✅ |
| MCP validado | ✅ `mcp_validated: true` |
| Tool calls registadas | ✅ 12 (create_funnel, create_page, create_section, create_block×3, get_page_tree×3, list_*) |
| Sem SQL/código | ✅ apenas MCP |
| BD | ✅ funnel `mcp-test-funnel`, page `mcp-test-sales-page`, Hero + heading/text/button |
| Preview | ✅ HTTP 200 — https://hub-dr-ecoom.vercel.app/preview/ai-test-offer/mcp-test-funnel/mcp-test-sales-page |
| Cross-offer | ✅ `CROSS_OFFER_ACCESS` ao aceder `onda-prodigio` com contexto `ai-test-offer` |

### Observability

Tabela `ai_task_tool_calls`: `task_id`, `offer_id`, `tool_name`, `success`, `error_code`, `timestamp`.

Worker log: `MCP validado: N tool call(s) para task <id>`.

MCP server stderr: `[hub-page-tools] tool_call <name> task=<id>`.

### Testes locais

65 testes passam (`npm test`).

---

## 13. Idempotência

- Slugs duplicados → `DUPLICATE_SLUG` (não cria silenciosamente)
- Agent deve usar `get_page_tree` / `list_*` antes de criar entidades com slugs fixos
- `duplicate_page` exige slug/name novos explicitamente

---

## 14. Limitações

- Sem publish/deploy automático
- Sem editor visual
- HTML block permitido mas desencorajado no prompt
- Worker ai-test-offer workspace é repo mínimo — MCP server corre a partir de `HUB_AGENT_REPO_ROOT`
- `agent mcp enable` deve ser executado uma vez por workspace (worker faz automaticamente)

---

## 15. Próxima fase — Fase 4

**FASE 4 — VISUAL PAGE BUILDER + TEMPLATES + AI SCREENSHOT-TO-PAGE**

Não iniciada neste branch.
