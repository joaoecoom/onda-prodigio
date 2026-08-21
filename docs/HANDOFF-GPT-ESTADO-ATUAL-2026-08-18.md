# Estado actual — HUB DR Ecoom / Onda Prodígio

**Documento para análise externa (GPT ou outro)** — realidade verificada em código, testes, BD produção e URLs live.

**Data:** 18 Agosto 2026 (actualizado após auditoria + circuito mínimo + chat Cursor)  
**Projecto Vercel:** `onda-prodigio` (alias produção HUB: `hub-dr-ecoom.vercel.app`)  
**Testes:** `npm test` → **132/132**  
**Supabase:** `vmyezkbkthguojmxhacw`  
**Documento complementar (detalhe histórico):** `docs/HANDOFF-GPT-ANALISE-COMPLETA.md`

---

## Índice

1. [Resumo executivo honesto](#1-resumo-executivo-honesto)
2. [O que mudou recentemente](#2-o-que-mudou-recentemente)
3. [URLs e superfícies](#3-urls-e-superfícies)
4. [Matriz de realidade por feature](#4-matriz-de-realidade-por-feature)
5. [HUB — shell e módulos](#5-hub--shell-e-módulos)
6. [Chat Cursor (dock global)](#6-chat-cursor-dock-global)
7. [Page Engine / Editor](#7-page-engine--editor)
8. [Funil legacy vs Page Engine (Onda)](#8-funil-legacy-vs-page-engine-onda)
9. [Stripe multi-oferta](#9-stripe-multi-oferta)
10. [AI Agent, MCP e worker VPS](#10-ai-agent-mcp-e-worker-vps)
11. [Base de dados e migrations](#11-base-de-dados-e-migrations)
12. [API — acções relevantes](#12-api--acções-relevantes)
13. [Design system](#13-design-system)
14. [Testes automatizados](#14-testes-automatizados)
15. [Gaps P0 / P1 / P2](#15-gaps-p0--p1--p2)
16. [O que o GPT deve analisar e propor](#16-o-que-o-gpt-deve-analisar-e-propor)
17. [Prompts prontos para o GPT](#17-prompts-prontos-para-o-gpt)
18. [Índice de ficheiros-chave](#18-índice-de-ficheiros-chave)

---

## 1. Resumo executivo honesto

**Produto alvo:** plataforma interna estilo Hotmart/Ticto para vender ofertas digitais da Angela Campos (DR Ecoom).

**O que gera receita hoje (Onda Prodígio):**
- Funil VSL estático (`funnel/index.html`) em https://onda-prodigio.vercel.app
- Checkouts Stripe €9 / €19 (`checkout9/`, `checkout19/`)
- Webhook → comunidade + Meta CAPI + GA4 + WhatsApp/email
- Métricas globais + admin membros

**O que está construído mas NÃO é ainda o runtime principal da Onda:**
- HUB DR Ecoom (admin multi-oferta, dark theme Ticto-like)
- Page Engine (funnels/pages/sections/blocks + editor visual + renderer)
- Integrações por oferta na BD
- Stripe/tracking resolvíveis por oferta (código)
- AI Agent + MCP + worker VPS

**Conclusão:** Existe **muito código avançado** e **infra BD aplicada**, mas a oferta real **ainda corre em HTML legacy**. O Page Engine funciona em produção para **ai-test-offer** e tem **primeira page Onda em draft**. O HUB tem UI para criar funnel/page e chat Cursor em baixo — falta **fechar o circuito comercial** (publicar Onda, checkout ligado ao engine, métricas por oferta).

---

## 2. O que mudou recentemente

| Data / sessão | Entrega | Estado |
|---------------|---------|--------|
| Auditoria realidade | Comparação handoff vs código/prod/BD | Concluída — ver matriz §4 |
| Migration **067** | `page_revisions` | **APPLIED** em produção |
| Migration **068** | Seed Onda `onda-principal` / `vsl-sales` | **APPLIED** — page em **draft** |
| API | `hub_funnel_create`, `hub_page_create`, rotas revisions | Wired em `sales-attribution.js` |
| HUB UI | Formulários criar funnel + page (módulo Funil) | Deployado `hub.js?v=17` |
| Bug fix | Heading `"undefined"` na BD + sanitização save | Corrigido |
| Chat Cursor | `hub-chat.js` — barra fixa em baixo em todas as abas | Deployado — preenche Integrações localmente; Agent via VPS |
| Stripe 6B | `lib/hub/stripe-client.js` multi-oferta | Código + testes; Onda checkout ainda estático |
| Design | HUB/editor/checkout dark roxo | Produção HUB |

---

## 3. URLs e superfícies

| Superfície | URL |
|------------|-----|
| HUB admin | https://hub-dr-ecoom.vercel.app |
| Funil público Onda (legacy) | https://onda-prodigio.vercel.app/funnel/ |
| Checkout €9 / €19 | `/checkout9/` · `/checkout19/` |
| Page Engine live | `/p/{offer}/{funnel}/{page}` |
| Page Engine preview | `/preview/{offer}/{funnel}/{page}?preview=1` |
| Editor visual | `/editor/{offer}/{funnel}/{page}` |
| Onda Page Engine (draft) | `/preview/onda-prodigio/onda-principal/vsl-sales?preview=1` |
| AI test page (published) | `/p/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page` |

**Auth HUB / Editor / Métricas:** password única → env `METRICS_DASHBOARD_PASSWORD` → Bearer token em `sessionStorage` (`onda-metrics-token`). Sem multi-user, sem roles.

**Assets HUB em produção (18 Ago):** `hub.css?v=12`, `hub.js?v=17`, `hub-chat.js?v=2`

---

## 4. Matriz de realidade por feature

Legenda: **Código** = implementado no repo · **Local** = testes unitários passam · **Prod** = verificado live/BD · **E2E** = jornada completa utilizador · **Estado**

| Feature | Código | Local | Prod | E2E | Estado real |
|---------|:------:|:-----:|:----:|:---:|-------------|
| HUB shell (login, sidebar, módulos) | ✅ | ✅ | ✅ | ⚠️ | **Funcional** |
| Chat Cursor (dock global) | ✅ | ⚠️ | ✅ | ⚠️ | **Parcial** — fill local Integrações; Agent depende VPS |
| Criar funnel/page (UI HUB) | ✅ | ✅ | ✅ | ⚠️ | **Funcional** — deploy recente |
| Visual Page Builder | ✅ | ✅ | ⚠️ | ⚠️ | **Parcial** — auth; não smoke browser completo |
| Drag & drop, undo/redo, autosave | ✅ | ✅ | ⚠️ | ❌ | **Implementado** |
| Publish / Preview / Renderer | ✅ | ✅ | ✅ | ⚠️ | **Funcional** (ai-test + preview Onda) |
| Revisions (histórico) | ✅ | ✅ | ✅ | ❌ | **BD OK** — UI editor; E2E não validado |
| Templates (4 section + 3 page) | ✅ | ✅ | ✅ | ⚠️ | **Funcional** — catálogo global, não por oferta |
| AI local (regex, editor) | ✅ | ✅ | ⚠️ | ⚠️ | **Limitado** |
| AI Agent (fila + VPS) | ✅ | ⚠️ | ⚠️ | ❌ | **Parcial** — 6 tasks completed na BD; worker não monitorizado |
| MCP hub-page-tools | ✅ | ⚠️ | ⚠️ | ❌ | **Worker-side only** |
| Screenshot → Page | ✅ | ⚠️ | ⚠️ | ❌ | **Parcial** — fallback template; vision precisa `OPENAI_API_KEY` |
| Funnel Engine (schema + service) | ✅ | ✅ | ✅ | ⚠️ | **Implementado** |
| Funnel builder UI | ⚠️ | ⚠️ | ⚠️ | ❌ | **Listagem + create** — não é canvas de funil |
| Multi-offer isolation | ✅ | ✅ | ⚠️ | ❌ | **Código OK**; Onda runtime legacy |
| Stripe multi-oferta | ✅ | ✅ | ⚠️ | ❌ | **Wired**; checkout Onda estático |
| Tracking por oferta | ✅ | ✅ | ⚠️ | ❌ | **Parcial** — legacy VSL incompleto |
| Métricas por oferta | ❌ | ❌ | ❌ | ❌ | **Não implementado** |
| Comunidade ↔ hub_offers | ❌ | ❌ | ❌ | ❌ | **Legacy products** |

---

## 5. HUB — shell e módulos

### Estrutura

```
hub/index.html + hub.js + hub.css
├── Login (password única)
├── Lista ofertas (+ card "Nova oferta")
└── Shell por oferta
    ├── Sidebar: Home + grupos (Marketing, Vendas, Automação, Plataforma)
    └── Módulos via hub_module API
```

### Módulos (`lib/hub/modules.js` + `lib/hub/module-data.js`)

| ID | Função real hoje |
|----|------------------|
| `tracking` | Status integrações tracking (read-only-ish) |
| `funil` | **Lista funnels/pages + links editor + UI criar funnel/page** |
| `dashboard` | Embed métricas (global, não filtra oferta) |
| `recupera` | WhatsApp recuperação |
| `impulsiona` | Fluxos pós-venda |
| `ai-agent` | UI completa AI Agent (form + tasks) |
| `comunidade` | Link/embed comunidade |
| `integracoes` | **Form credenciais por oferta** (BD + env fallback) |

### Ofertas na BD (`hub_offers`)

- `onda-prodigio` — oferta real, legacy runtime
- `ai-test-offer` — fixture Page Engine + testes agent/MCP
- `teste`, `teste3`, etc. — rascunhos criados no HUB

### Pages Page Engine (produção, verificado 18 Ago)

| Oferta | Funnel | Page | Status |
|--------|--------|------|--------|
| ai-test-offer | ai-test-sales-funnel | ai-test-sales-page | **published** |
| ai-test-offer | agent-e2e-funnel, mcp-test-funnel, ai-generated-funnel | … | draft |
| onda-prodigio | onda-principal | vsl-sales | **draft** |

---

## 6. Chat Cursor (dock global)

**Ficheiros:** `hub/hub-chat.js`, markup em `hub/index.html`, estilos em `hub.css`

**Comportamento:**
- Barra **fixa em baixo** em todas as abas do HUB (após login)
- Label **Cursor**, botão ✦ expande painel (mensagens + sugestões)
- **Modo local (Integrações):** cola `key=value`, JSON, ou linguagem natural (`mete vturb player id com …`) → preenche `[data-integration-key]` → utilizador clica **Guardar integrações**
- **Modo Agent:** pedidos maiores → `hub_ai_task_create` → worker VPS Cursor → poll status

**Limitações actuais (importante para GPT melhorar):**
- Só preenche **Integrações** localmente — outros módulos vão directo para Agent ou falham
- Não grava automaticamente — requer clique manual em Guardar
- Não está no **editor** (`/editor/...`) — editor tem AI panel próprio
- Agent depende de worker VPS activo (estado contínuo desconhecido)
- Sem streaming de resposta — só poll task
- Sem contexto visual do formulário enviado ao Agent (só texto + módulo/oferta)

**Bug corrigido (18 Ago):** chat injectado dentro do CSS grid do `hub-shell` ficava invisível — movido para fora do grid, `position: fixed`, `z-index: 10000`.

---

## 7. Page Engine / Editor

### Stack

```
Offer → Funnel → Page → Section → Block  (Supabase)
         ↓
lib/hub/funnel-engine/     CRUD + getPageTreeBySlugs
lib/hub/page-builder/      save, publish, revisions, templates, AI, screenshot
lib/hub/page-renderer/     HTML público /p/ e preview
hub/editor.html + editor.js + editor-dnd.js + editor-ai.js + editor-screenshot.js
```

### Editor — funcionalidades (código + testes)

- Seleccionar section/block, inspector, add/delete/duplicate
- Reorder setas + drag & drop (`editor-dnd.js`)
- Undo/redo (50 níveis), autosave 2.5s, save manual, publish
- Canvas via POST `hub_page_render`
- Templates panel, revisions panel, AI panel (local + agent), screenshot upload
- Device toggle = **só CSS width** (768/390px), não viewport real

### Templates (`lib/hub/page-builder/templates/catalog.js`)

- **4 sections:** hero-standard, benefits-list, cta-simple, social-proof
- **3 pages:** sales-basic, sales-minimal, sales-full
- Catálogo **global em código**, não por oferta

### API create (novo)

- `POST hub_funnel_create` — body: `{ offer, name, slug?, type? }`
- `POST hub_page_create` — body: `{ offer, funnel, name, slug?, template_id? }` → seed via `seed-template.js`

---

## 8. Funil legacy vs Page Engine (Onda)

### Hoje (receita real)

```
onda-prodigio.vercel.app
├── funnel/          ← VSL Vturb (estático)
├── checkout9/       ← €9 Stripe estático
├── checkout19/      ← €19
├── comunidade/
└── obgd/            ← upsells
```

### Page Engine Onda (draft, migration 068)

- Funnel `onda-principal`, page `vsl-sales`
- Conteúdo: hero Onda + benefits + CTA → `/checkout9/`
- Preview OK: `/preview/onda-prodigio/onda-principal/vsl-sales?preview=1`
- **Não published** — `/p/...` requer publish no editor
- **Não substitui** VSL legacy automaticamente

---

## 9. Stripe multi-oferta

**Ficheiro central:** `lib/hub/stripe-client.js` (Fase 6B)

- Resolve offer → integrações + checkouts em `hub_offer_checkouts`
- Webhook multi-secret
- `checkout9/checkout.js` passa `offer_slug` quando disponível
- **Fallback env** quando oferta não encontrada (legacy Onda)

**Gap:** checkouts HTML estáticos; Page Engine pages não têm bloco checkout nativo integrado.

---

## 10. AI Agent, MCP e worker VPS

### Infra

- Tabela `ai_tasks` + `ai_task_tool_calls` (063, 066) — **applied**
- Handler `lib/hub/handlers/ai-tasks.js`
- Worker `scripts/hub-agent/worker/poll-tasks.js` (Contabo VPS)
- MCP `scripts/hub-agent/mcp/hub-page-tools-server.js`
- Agent tools `lib/hub/agent-tools/` (create funnel/page, update blocks, etc.)

### Histórico produção (ai_tasks)

- 6 tasks `completed`, 2 `failed` (verificado auditoria)
- Funnels de teste na BD: `mcp-test-funnel`, `agent-e2e-funnel`, `ai-generated-funnel`

### Limitações

- Worker VPS: **não monitorizado** continuamente nesta sessão
- Sem fila visível no chat dock (só no módulo ai-agent)
- Screenshot vision: `OPENAI_API_KEY` no Vercel — fallback template se ausente

---

## 11. Base de dados e migrations

**Projecto:** `vmyezkbkthguojmxhacw`

| Migration | Conteúdo | Estado |
|-----------|----------|--------|
| 060 | hub_offers, integrações, checkouts | APPLIED |
| 061 | hub_offer_domains | APPLIED |
| 062 | domínios Vercel | APPLIED |
| 063 | ai_tasks | APPLIED |
| 064 | OfferContext cols em hub_offers | APPLIED |
| 065 | Funnel Engine + seed ai-test-offer | APPLIED |
| 066 | ai_task_tool_calls | APPLIED |
| 067 | page_revisions | APPLIED (18 Ago) |
| 068 | Seed Onda Page Engine + fix ai-test heading | APPLIED (18 Ago) |

**Tabelas Page Engine:** `funnels`, `pages`, `page_sections`, `page_blocks`, `page_revisions`

---

## 12. API — acções relevantes

Monolith: `api/sales-attribution.js` (auth Bearer)

### HUB

| Acção | Método | Notas |
|-------|--------|-------|
| `hub_offers` | GET | Lista ofertas |
| `hub_offer` | GET | Detalhe + módulos |
| `hub_module` | GET | Dados módulo |
| `hub_create_offer` | POST | Nova oferta |
| `hub_save_integrations` | POST | Guarda credenciais BD |
| `hub_funnel_create` | POST | **Novo** — criar funnel |
| `hub_page_create` | POST | **Novo** — criar page + template opcional |
| `hub_funnel_list` | GET | Funis da oferta |
| `hub_page_list` | GET | Pages do funil |
| `hub_page_tree` | GET | Árvore editor |
| `hub_page_builder_save` | POST | Save diff |
| `hub_page_builder_publish` | POST | Publish/unpublish |
| `hub_page_revisions` | GET | Lista revisions |
| `hub_page_revision_restore` | POST | Restore |
| `hub_page_render` | POST | Canvas HTML |
| `hub_page_builder_ai` | POST | AI local server-side |
| `hub_page_builder_ai_agent` | POST | Task agent page builder |
| `hub_page_builder_screenshot` | POST | Screenshot analyze |
| `hub_ai_task_create` | POST | Task agent geral |
| `hub_ai_task` | GET | Status task |

### Público

| Rota | Handler |
|------|---------|
| `/p/:offer/:funnel/:page` | page-preview (live) |
| `/preview/...?preview=1` | page-preview (draft) |
| `/{funnel}/{page}` em domínio funil | page-domain |

---

## 13. Design system

- **HUB / Editor login:** dark roxo, Plus Jakarta Sans, tokens `--hub-*` em `hub/hub.css`
- **Checkout:** dark trust pills (`checkout9/checkout.css?v=2`)
- **Pages publicadas Page Engine:** light Inter (renderer default) — **inconsistência visual**
- **Chat dock:** barra gradiente roxa em baixo, label "Cursor"

Referência desejada: Ticto (dark, premium, cards, sidebar icons).

---

## 14. Testes automatizados

```bash
npm test  # 132 testes, 0 fail
```

| Ficheiro | Cobertura |
|----------|-----------|
| `tests/funnel-engine.test.js` | CRUD funnels/pages/sections/blocks |
| `tests/page-builder.test.js` | Editor state, save, reorder, undo |
| `tests/page-builder-publish.test.js` | Publish URLs |
| `tests/page-builder-revisions.test.js` | Snapshots |
| `tests/page-builder-templates.test.js` | Catalog |
| `tests/page-builder-ai.test.js` | AI local + agent prompt |
| `tests/page-builder-screenshot.test.js` | Screenshot fallback |
| `tests/page-builder-create.test.js` | Seed template + sanitização |
| `tests/page-renderer.test.js` | HTML output |
| `tests/agent-tools.test.js` | MCP tools |
| `tests/stripe-multi-offer.test.js` | Stripe por oferta |
| `tests/offer-context*.test.js` | OfferContext |

**Não existe:** E2E browser (Playwright), testes contra Supabase produção, testes worker VPS.

---

## 15. Gaps P0 / P1 / P2

### P0 — bloqueia utilização real como plataforma de vendas

1. **Onda ainda 100% legacy** para tráfego pago — VSL + checkout estático
2. **Page Onda não published** — existe em draft, não substitui funil
3. **Checkout desligado do Page Engine** — pages não fecham venda nativamente
4. **Métricas não filtram por oferta** — dashboard global no HUB
5. **Chat preenche só Integrações** — objectivo "preencher tudo com IA" incompleto

### P1 — operacional

1. Publicar `vsl-sales` + smoke E2E edit → save → publish → live
2. Bridge Onda: domínio raiz ou `/funnel/` → Page Engine (ou A/B)
3. Chat Cursor: preencher **todos** os módulos (tracking, funil forms, etc.)
4. Chat: auto-save opcional ou botão "Aplicar e guardar"
5. Monitorizar worker VPS + health check no HUB
6. Métricas por oferta no módulo dashboard
7. Editor E2E smoke automatizado

### P2 — melhoria

1. Device preview real (iframe)
2. Templates por oferta / marketplace
3. Design unificado pages publicadas (dark option)
4. Comunidade ligada a `hub_offers`
5. Multi-user / roles no HUB
6. Streaming AI no chat (SSE) em vez de poll task
7. Screenshot vision fiável em produção

---

## 16. O que o GPT deve analisar e propor

Ao analisar este projecto, o GPT deve **priorizar propostas accionáveis** com:

1. **Impacto comercial** — Onda a vender via HUB/Page Engine
2. **UX Angela** — preencher/configurar tudo pelo chat em baixo, sem terminal
3. **Mínimo diff** — reutilizar `funnel-engine`, `page-builder`, APIs existentes
4. **Prova** — não assumir roadmap docs como concluído; exigir E2E

### Áreas para propostas concretas

| Área | Pergunta guia |
|------|---------------|
| Chat Cursor | Como generalizar fill para funil, tracking, checkouts? LLM local vs Agent? |
| Page Engine | Qual a migração mínima Onda VSL → engine sem perder Vturb? |
| Checkout | Bloco checkout no renderer vs redirect checkout9? |
| Métricas | Como filtrar `metricas/` por `hub_offers.id`? |
| AI | Worker down — fallback? UI honesta? |
| Produto | Wizard onboarding oferta (integrações → funil → publish → domínio)? |
| Design | Unificar dark theme pages publicadas? |
| Arquitectura | Monolith `sales-attribution.js` — split handlers? |

### O que NÃO propor (unless P2)

- Reescrever stack
- Novo CMS externo
- Multi-tenant SaaS completo antes de Onda funcionar

---

## 17. Prompts prontos para o GPT

### Prompt A — Plano comercial mínimo (Onda)

```
Lê docs/HANDOFF-GPT-ESTADO-ATUAL-2026-08-18.md e o código em lib/hub/page-builder/, funnel/, checkout9/.

Objectivo: Onda Prodígio a vender via Page Engine em 2 semanas.

Propõe plano em fases com: migrations, URLs, publish, redirect legacy, checkout, tracking, riscos.
Máximo 15 passos. Cada passo: ficheiros a tocar + critério de done verificável.
```

### Prompt B — Chat Cursor universal

```
Analisa hub/hub-chat.js, hub/hub.js renderIntegracoesModule, lib/hub/module-data.js.

Objectivo: chat em baixo preenche QUALQUER formulário visível no módulo activo (integrações, funil, tracking).

Propõe arquitectura: registry de campos por módulo, parser NL, quando usar local vs Agent.
Inclui pseudocódigo e lista de ficheiros. Não reimplementes o page builder.
```

### Prompt C — Auditoria de gaps

```
Com base na matriz §4 do HANDOFF-GPT-ESTADO-ATUAL-2026-08-18.md,

Reclassifica P0/P1/P2 para o objectivo "Hotmart interna para as minhas ofertas".
Identifica as 3 quick wins de maior ROI esta semana.
```

### Prompt D — Design UX Ticto

```
Compara hub/hub.css, hub/editor.css, lib/hub/page-renderer/styles.js.

Propõe tokens unificados dark + checklist de inconsistências HUB vs pages publicadas vs checkout.
Prioriza o que Angela vê ao configurar uma oferta nova.
```

### Prompt E — AI Agent fiabilidade

```
Analisa scripts/hub-agent/, lib/hub/handlers/ai-tasks.js, hub/hub-ai.js, hub/hub-chat.js.

Propõe: health check worker, retry, cancel task, feedback no chat dock, logs visíveis.
Estima esforço S/M/L por item.
```

---

## 18. Índice de ficheiros-chave

```
hub/
  index.html, hub.js, hub.css, hub-chat.js, hub-ai.js
  editor.html, editor.js, editor.css, editor-dnd.js, editor-ai.js, editor-screenshot.js

lib/hub/
  funnel-engine/          # CRUD + getPageTreeBySlugs
  page-builder/           # save, publish, revisions, templates, ai, screenshot, seed-template
  page-renderer/          # HTML público
  handlers/page-builder.js, ai-tasks.js, module-data.js, save-integrations.js
  stripe-client.js        # multi-oferta Stripe
  offer-context.js, integrations-store.js, modules.js, offers.js
  agent-tools/            # executor MCP

api/
  sales-attribution.js    # monolith routes
  stripe-webhook.js, create-payment-intent.js, tracking-config.js

supabase/migrations/
  060–068                 # hub + funnel engine + ai + revisions + onda seed

scripts/hub-agent/        # worker VPS + MCP

tests/                    # 132 testes

docs/
  HANDOFF-GPT-ANALISE-COMPLETA.md      # detalhe histórico longo
  HANDOFF-GPT-ESTADO-ATUAL-2026-08-18.md  # ESTE documento (fonte de verdade actual)
  FASE-*.md                            # roadmap por fase (não prova conclusão)
```

---

## Nota final para o GPT

**Regra de ouro:** O roadmap em `docs/FASE-*.md` descreve intenção. A prova de conclusão é:

1. Código wired end-to-end
2. Teste automatizado (se aplicável)
3. Funciona em https://hub-dr-ecoom.vercel.app ou URL pública equivalente
4. Jornada utilizador completa (login → acção → resultado persistido)

Quando houver conflito entre este documento e `HANDOFF-GPT-ANALISE-COMPLETA.md`, **prevalece este** (estado verificado 18 Ago 2026).
