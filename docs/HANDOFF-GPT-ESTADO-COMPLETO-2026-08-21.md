# Estado completo do projecto — HUB DR Ecoom / Onda Prodígio

**Documento único para handoff (GPT → Cursor)**  
**Data:** 21 Agosto 2026  
**Repo:** `/Volumes/Remote Nrl /Cursor/Projetos/Onda Prodigio`  
**Branch:** trabalho local **não commitado** (grande diff em aberto)  
**Testes:** `npm test` → **153/153**  
**Supabase produção:** `vmyezkbkthguojmxhacw` · https://vmyezkbkthguojmxhacw.supabase.co  
**Conta Supabase:** suporte.angelacampos@gmail.com  
**Deploy:** Vercel project `onda-prodigio`  
**Documentos anteriores:** `docs/HANDOFF-GPT-ESTADO-ATUAL-2026-08-18.md`, `docs/HANDOFF-GPT-ANALISE-COMPLETA.md`, fases 1–7 em `docs/FASE-*.md`

---

## TL;DR (30 segundos)

| | |
|---|---|
| **Produto alvo** | Plataforma multi-oferta estilo Hotmart/Memberfy/Ticto para a Angela Campos (DR Ecoom) |
| **O que vende hoje** | Onda Prodígio em HTML legacy: funil VSL + checkout Stripe €9/€19 + comunidade hardcoded |
| **O que está construído** | HUB admin, Page Engine, editor visual, Stripe/tracking multi-oferta (código), métricas por oferta (código), CMS comunidade + editor inline, AI Agent + worker VPS |
| **Gap principal** | Muito código avançado; **runtime comercial da Onda ainda não migrou** para Page Engine + comunidade genérica por oferta |
| **Pedido do João** | Parar passo-a-passo; quer **lista consolidada de próximos passos** para o Cursor executar em blocos |

---

## Princípios do utilizador (NÃO violar)

1. **Onda Prodígio intacta** — nunca apagar os 5 módulos / conteúdo existente; é referência, não template obrigatório para novas ofertas.
2. **Novas ofertas = canvas vazio** — construir livremente (módulos/aulas), sem copiar estrutura OP.
3. **Comunidade no domínio da oferta** — runtime membro + edição de conteúdo no site da oferta.
4. **Métricas no HUB** — dashboard central no domínio HUB, não na comunidade.
5. **Entrada gestor** — HUB → «Abrir comunidade» deve dar **modo gestor** (admin, tudo desbloqueado), não «Membro».
6. **Sem badge «Resposta automática»** nos comentários da comunidade.
7. **Editor in-community** — arrastar, criar, editar módulos/aulas **dentro da UI da comunidade**, por oferta (estilo Hotmart/Memberfy).
8. **Auth HUB** — password única (`METRICS_DASHBOARD_PASSWORD`); sem multi-user/roles por agora.

---

## URLs e superfícies

| Superfície | URL |
|------------|-----|
| **HUB admin** | https://hub-dr-ecoom.vercel.app |
| **Funil Onda (legacy)** | https://onda-prodigio.vercel.app/funnel/ |
| **Checkout €9 / €19** | `/checkout9/` · `/checkout19/` |
| **Comunidade Onda** | https://onda-prodigio.vercel.app/comunidade/ |
| **Admin membros** | `/adm/` (domínio oferta ou HUB com `?offer=`) |
| **Page Engine live** | `/p/{offer}/{funnel}/{page}` |
| **Preview** | `/preview/{offer}/{funnel}/{page}?preview=1` |
| **Editor visual** | `/editor/{offer}/{funnel}/{page}` |
| **Onda Page Engine (draft)** | `/preview/onda-prodigio/onda-principal/vsl-sales?preview=1` |
| **AI test (published)** | `/p/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page` |

**Auth:** Bearer token `onda-metrics-token` em `sessionStorage` (HUB, métricas, adm embed).

**Migrations:** `./scripts/apply-supabase-migration.sh supabase/migrations/NNN_nome.sql` (não insistir no OAuth Supabase genérico).

---

## Matriz de realidade (Agosto 2026)

Legenda: **Código** · **Testes** · **Prod live** · **E2E utilizador**

| Área | Código | Testes | Prod | E2E | Notas |
|------|:------:|:------:|:----:|:---:|-------|
| HUB shell v2 (sidebar, offer switcher, PT-PT) | ✅ | ✅ | ⚠️ | ⚠️ | Design system `assets/platform.*` |
| Módulos HUB (10 abas por oferta) | ✅ | ✅ | ⚠️ | ⚠️ | Dashboard, tracking, funil, comunidade embed, etc. |
| Apagar/arquivar oferta | ✅ | ✅ | ⚠️ | ❌ | `delete-offer` handler |
| Definições + domínios oferta | ✅ | ✅ | ⚠️ | ❌ | Activos no HUB (já não «Em breve») |
| Métricas plataforma + por oferta | ✅ | ✅ | ⚠️ | ❌ | Stripe + Meta multi-conta |
| Meta contas por oferta | ✅ | ✅ | ⚠️ | ❌ | `meta-accounts-store` |
| Page Engine + renderer | ✅ | ✅ | ✅ | ⚠️ | ai-test published; Onda em draft |
| Visual builder (DnD, autosave, revisions) | ✅ | ✅ | ⚠️ | ❌ | |
| Templates + screenshot→page | ✅ | ✅ | ⚠️ | ❌ | Vision precisa `OPENAI_API_KEY` |
| Stripe multi-oferta | ✅ | ✅ | ⚠️ | ❌ | Checkout Onda ainda estático |
| Tracking runtime por oferta | ✅ | ✅ | ⚠️ | ❌ | Legacy VSL incompleto |
| AI Agent + fila + VPS worker | ✅ | ⚠️ | ⚠️ | ❌ | MCP hub-page-tools |
| **CMS comunidade (API)** | ✅ | ✅ | ⚠️ | ❌ | CRUD + reorder + upload |
| **Editor `/adm/` tab Conteúdo** | ✅ | — | ⚠️ | ❌ | Drag-drop, uploads |
| **Editor inline comunidade** | ✅ | — | ⚠️ | ❌ | **Novo — sessão desta semana** |
| Handoff HUB→comunidade gestor | ✅ | ✅ | ⚠️ | ❌ | HMAC assinado, 2 min TTL |
| Comunidade `produto.js` genérico | ❌ | — | — | ❌ | ~2500 linhas hardcoded por productId |
| Produtos isolados por `offer_id` | ❌ | — | — | ❌ | Catálogo global legacy |
| Checkout ligado ao Page Engine | ❌ | — | — | ❌ | |
| Funil Onda migrado para engine | ❌ | — | — | ❌ | Seed draft existe |

---

## 1. Runtime comercial actual (Onda Prodígio)

Isto é o que **facto** gera receita hoje:

```
Meta Ads → onda-prodigio.vercel.app/funnel/ (HTML estático)
         → checkout9 / checkout19 (Stripe PaymentIntent)
         → webhook Stripe → Supabase + email/WhatsApp + CAPI/GA4
         → /comunidade/ (login membro)
         → /comunidade/produto?id=onda-prodigio (player hardcoded)
```

- **Funil:** `funnel/index.html` — não Page Engine.
- **Checkout:** `checkout9/`, `checkout19/` — amounts/env estáticos; código multi-oferta existe mas não substitui estes.
- **Comunidade:** tabelas `products`, `content_modules`; lógica UI em `comunidade/produto.js` com branches por `productId` e `sort_order`.
- **Admin membros:** `/adm/` — convites, acessos, questionário.
- **Métricas globais:** `/metricas/` — password única.

---

## 2. HUB DR Ecoom (admin multi-oferta)

### Shell (Fase 7A/7B — concluída)

- **Design system:** `assets/platform.css`, `platform-icons.js`, `platform-ui.js`
- **Shell:** `hub/index.html`, `hub/hub.js`, `hub/hub-v2.css`, `hub/hub.css`
- Dark theme, sidebar colapsável, offer switcher, command palette (⌘K), toasts, empty states honestos (KPIs `—` se sem dados)
- **Idioma:** PT-PT na shell

### Módulos por oferta (`lib/hub/modules.js`)

| ID | Label | Estado |
|----|-------|--------|
| ai-agent | AI Agent | live |
| dashboard | Dashboard (métricas embed) | live |
| tracking | Tracking | live |
| recupera | Recupera | live |
| impulsiona | Impulsiona | live |
| comunidade | Comunidade | live — iframe `/adm/?embed=1&tab=content` no **domínio HUB** (fix X-Frame-Options) |
| integracoes | Integrações | live |
| funil | Funil / Page Engine | live |
| dominios | Domínios | live |
| definicoes | Definições | live |

### Funcionalidades HUB recentes

- **Criar / listar ofertas** — `lib/hub/offers.js`
- **Apagar oferta** — `lib/hub/handlers/delete-offer.js` (archive)
- **Definições oferta** — `lib/hub/offer-settings.js`, handler `save-offer-settings.js`
- **Domínios** — `lib/hub/handlers/page-domain.js`, `page-builder/domain-routing.js`, migration 061/062
- **Integrações por oferta** — `lib/hub/integrations-store.js`, Stripe keys, GA4, Meta, etc.
- **Meta multi-conta** — `lib/hub/meta-accounts-store.js`, `meta-metrics.js`
- **Métricas overview** — `lib/hub/hub-metrics.js`, handler `metrics-overview.js`
- **Offer context** — `lib/hub/offer-context.js` (contexto para AI Agent)
- **Abrir comunidade como gestor** — `hub.js` → `openCommunityGestor()` → handoff assinado

### Chat Cursor (`hub/hub-chat.js`)

- Barra fixa em baixo em todas as abas
- Preenche Integrações localmente (regex)
- Agent remoto via fila `ai_tasks` + worker VPS

---

## 3. Page Engine / Editor visual

### Stack

| Camada | Path |
|--------|------|
| Schema BD | migrations 065, 067, 068 |
| Funnel engine | `lib/hub/funnel-engine/` |
| Page builder API | `lib/hub/handlers/page-builder.js` |
| Renderer | `lib/hub/page-renderer/` |
| Editor UI | `hub/editor.html`, `editor.js`, `editor-dnd.js`, `editor-ai.js`, `editor-screenshot.js` |
| Publish / preview | `lib/hub/page-builder/publish.js`, `handlers/page-preview.js` |
| Revisions | `lib/hub/page-builder/revisions.js` |
| Templates | `lib/hub/page-builder/templates/` |

### Capacidades implementadas

- CRUD funnels, pages, sections, blocks
- Editor visual com drag-and-drop, undo/redo, autosave
- Publish → URL `/p/...`; preview com `?preview=1`
- Histórico de versões (`page_revisions`)
- 4 section templates + 3 page templates (catálogo global)
- AI local no editor (regex/transformações)
- Screenshot → page (vision + fallback template)
- Seed Onda: funnel `onda-principal`, page `vsl-sales` — **draft**

### Rotas Vercel

- `/p/*`, `/preview/*`, `/editor/*` — ver `vercel.json`

---

## 4. Stripe, tracking, métricas

### Stripe multi-oferta (`lib/hub/stripe-client.js`)

- Resolve client/keys por oferta via integrações
- Checkout settings builder, metadata `offer_slug`
- **Testes:** `tests/stripe-multi-offer.test.js`
- **Runtime Onda:** ainda usa checkout estático

### Tracking (`lib/tracking/`, `assets/tracking.js`)

- Meta CAPI, GA4 MP, server events
- `lib/tracking/offer-tracking.js` — runtime por oferta
- Config API: `api/tracking-config.js`
- **Testes:** `tests/tracking-offer-runtime.test.js`

### Métricas HUB (`lib/hub/hub-metrics.js`)

- Overview plataforma + métricas por oferta (Stripe sales, Meta spend, etc.)
- UI em `hub.js` (home oferta + dashboard embed)
- **Testes:** `tests/hub-metrics.test.js`, `tests/meta-accounts.test.js`

---

## 5. AI Agent + infra VPS

### Fila de tarefas

- Tabela `ai_tasks` (migration 063)
- Tool calls log (066)
- Offer context (064)
- Handlers: `lib/hub/handlers/ai-tasks.js`, `lib/hub/ai-tasks.js`
- Agent tools: `lib/hub/agent-tools/` (registry, executor, context)

### Worker VPS (Contabo)

Scripts em `scripts/hub-agent/`:

- `poll-tasks.js` — worker
- `run-agent-task.sh`, `deploy-worker-vps.sh`
- MCP: `scripts/hub-agent/mcp/hub-page-tools-server.js`
- Offer context client no worker

**Estado:** código completo; worker **não monitorizado** em produção de forma fiável.

---

## 6. Comunidade + CMS (detalhe — trabalho recente)

### Arquitectura de domínios

| Acção | Onde corre |
|-------|------------|
| Ver/editar conteúdo membro | Domínio da **oferta** (`onda-prodigio.vercel.app/comunidade/`) |
| Métricas, dashboard Meta | Domínio do **HUB** |
| Tab Comunidade no HUB | Iframe `/adm/?offer=X&embed=1&tab=content` no domínio HUB (same-origin) |

### API CMS (`lib/comunidade/content-admin.js`)

**Rota:** `GET/POST /api/comunidade/content-admin`

**Auth:** token métricas OU admin Supabase (`handlers/content-admin.js`)

**Acções POST:**

| action | Descrição |
|--------|-----------|
| `reorder` | Reordenar módulos ou aulas (`parent_id` + `ordered_ids`) |
| `update` | Patch campos (title, description, type, youtube_id, paths, drip…) |
| `create_module` | Novo módulo |
| `create_lesson` | Nova aula dentro de módulo |
| `delete` | Apagar módulo (cascade aulas) ou aula |
| `upload` | Upload ≤3MB base64 |
| `prepare_upload` | Signed URL Supabase Storage |

**Upload:** `lib/comunidade/content-upload.js` + bucket `comunidade-uploads` (migration **069**)

### UI Admin (`/adm/`)

- Tab **Conteúdo** — `adm/content.js`, `adm/index.html`
- Drag-and-drop, editor lateral, uploads
- Botão «Editar conteúdo» na comunidade (modo gestor) → redirect adm

### Editor inline na comunidade (**NOVO**)

| Ficheiro | Função |
|----------|--------|
| `comunidade/content-editor.js` | Editor reutilizável; monta em qualquer container |
| `comunidade/content-editor.css` | Estilos |
| `comunidade/index.js` | Modo edição na home + «Gerir conteúdo» por card |
| `comunidade/produto.js` | Botão «Modo edição» / `?edit=1` |

**Funcionalidades editor inline:**

- Arrastar e soltar (⋮⋮) módulos e aulas
- Criar módulo / aula
- Editar título/descrição inline
- Painel lateral: tipo, YouTube, URLs, uploads, drip
- Apagar
- **Selector de programa** quando oferta tem 2+ produtos

### Handoff gestor HUB → comunidade

| Ficheiro | Função |
|----------|--------|
| `lib/comunidade/hub-admin-access.js` | Token HMAC, TTL 2 min, serverless-safe |
| `comunidade/hub-enter.js` | Consome handoff, setSession, redirect `?offer=` |
| `comunidade/index.js` | Barra «Modo gestor», produtos desbloqueados, chip «Gestor» |

**Problema conhecido:** se entrar directo ou sessão membro antiga, vê «Membro» + zero produtos — precisa handoff ou login admin.

### Comunidade runtime membro

- `comunidade/index.html/js` — grid de programas, hero, roadmap
- `comunidade/produto.js` — **~2600 linhas**, lógica especial por produto:
  - `onda-prodigio`, `clube-super-cerebros`, order bumps, surveys, genius test, comentários, drip, etc.
- `comunidade/produto.html` — views: grelha módulos, lista aulas, player, comentários
- Comentários: módulo por módulo; suporte admin; **sem** badge auto-reply

### Testes comunidade

- `tests/content-admin.test.js`
- `tests/content-upload.test.js`
- `tests/hub-admin-access.test.js`

---

## 7. Base de dados — migrations relevantes

| # | Ficheiro | Conteúdo |
|---|----------|----------|
| 001–059 | — | Fundação comunidade, módulos OP, clube, comentários, progresso… |
| 060 | `hub_offers.sql` | Tabela ofertas HUB |
| 061 | `hub_offer_domains.sql` | Domínios por oferta |
| 062 | `hub_domain_vercel.sql` | Vercel domains |
| 063 | `ai_tasks.sql` | Fila AI Agent |
| 064 | `offer_context.sql` | Contexto AI |
| 065 | `funnel_engine.sql` | Page Engine schema |
| 066 | `ai_task_tool_calls.sql` | Log tool calls |
| 067 | `page_revisions.sql` | Histórico páginas |
| 068 | `onda_page_engine_seed.sql` | Seed Onda draft |
| 069 | `comunidade_uploads_storage.sql` | Bucket uploads CMS |

**Tabelas legacy comunidade:** `products`, `content_modules`, `members`, `member_access`, `member_progress`, `comments`, etc.

**Gap:** `products` não tem `offer_id` — catálogo não isola automaticamente por oferta nova.

---

## 8. Testes automatizados (153)

```
tests/agent-tools.test.js
tests/content-admin.test.js
tests/content-upload.test.js
tests/delete-offer.test.js
tests/funnel-engine.test.js
tests/hub-admin-access.test.js
tests/hub-metrics.test.js
tests/hub-modules.test.js
tests/meta-accounts.test.js
tests/offer-context.test.js
tests/offer-context-resolution.test.js
tests/offer-settings.test.js
tests/page-builder*.test.js (8 ficheiros)
tests/page-renderer.test.js
tests/stripe-multi-offer.test.js
tests/tracking-offer-runtime.test.js
```

Comando: `npm test`

---

## 9. Problemas conhecidos

| # | Problema | Impacto |
|---|----------|---------|
| 1 | Sessão «Membro» em vez de gestor | Editor inline invisível; produtos bloqueados |
| 2 | `produto.js` hardcoded | Novas ofertas não funcionam sem fork massivo |
| 3 | Produtos sem `offer_id` | Nova oferta não isola catálogo |
| 4 | Funil Onda legacy | Page Engine não é runtime principal |
| 5 | Checkout estático | Stripe multi-oferta não usado na Onda |
| 6 | AI worker VPS | Não monitorizado; Agent intermitente |
| 7 | Git não commitado | Risco perda; deploy pode estar desactualizado |
| 8 | Editor inline sem testes E2E | Só testes API; UI não validada browser |
| 9 | Iframe comunidade HUB | Funciona no domínio HUB; embed cross-origin foi corrigido |
| 10 | Nova oferta sem produto | Editor mostra empty; precisa criar produto primeiro |

---

## 10. O que NÃO está feito (backlog consolidado)

### P0 — Desbloquear produto multi-oferta real

1. **`produto.js` genérico** — renderer por árvore `content_modules`; manter branches OP como override opcional, não default.
2. **Produtos por oferta** — migration `offer_id` em `products` + filtro API `/api/comunidade/products`.
3. **Handoff gestor fiável** — garantir 100% que HUB → comunidade = admin; debug sessão cruzada.
4. **Commit + deploy** — consolidar diff actual em produção.

### P1 — Fechar circuito comercial Onda

5. **Publicar page Onda** no Page Engine (`vsl-sales` draft → published).
6. **Checkout dinâmico** por oferta (substituir checkout9 estático ou wrapper).
7. **Funil Onda** apontar para `/p/onda-prodigio/...` ou redirect.
8. **Tracking runtime** completo na page publicada (pixel, CAPI, GA4 por oferta).

### P2 — Comunidade estilo Hotmart/Memberfy

9. **Editor inline no player** — editar aula actual sem sair do view-lesson.
10. **Criar produto/programa** dentro da comunidade (hoje só módulos/aulas).
11. **Branding por oferta** — hero, mascot, copy da home comunidade via BD/settings.
12. **Preview membro vs gestor** — toggle mais óbvio na UI.

### P3 — HUB polish

13. **Métricas E2E** — validar Meta multi-conta em prod com conta real.
14. **Domínios custom** — fluxo completo Vercel + DNS documentado e testado.
15. **AI Agent** — health check worker, retry, UI de logs no HUB.
16. **Screenshot→page** — validar com OPENAI_API_KEY em prod.

### P4 — Técnico / dívida

17. Testes E2E browser (Playwright) para fluxos críticos.
18. Unificar `adm/content.js` e `comunidade/content-editor.js` (DRY).
19. Roles/auth multi-user (futuro).
20. Documentação operacional deploy/migrations para Angela.

---

## 11. Ficheiros-chave (mapa rápido)

```
hub/
  index.html, hub.js, hub-v2.css, hub.css, hub-chat.js, hub-ai.js
  editor.html, editor.js, editor-dnd.js, editor-ai.js, editor-screenshot.js, editor.css

comunidade/
  index.html, index.js
  produto.html, produto.js          ← LEGACY pesado
  content-editor.js, content-editor.css  ← editor inline NOVO
  hub-enter.html, hub-enter.js      ← handoff gestor
  auth.js, comunidade.css

adm/
  index.html, adm.js, adm.css
  content.js                        ← editor tab Conteúdo

lib/hub/
  offers.js, modules.js, hub-metrics.js, offer-context.js
  stripe-client.js, integrations-store.js, meta-accounts-store.js
  funnel-engine/, page-builder/, page-renderer/
  handlers/                         ← API handlers HUB
  agent-tools/

lib/comunidade/
  content-admin.js, content-upload.js
  hub-admin-access.js
  handlers/content-admin.js

api/
  sales-attribution.js              ← router HUB API
  stripe-webhook.js, create-payment-intent.js
  comunidade/[[...slug]].js
  tracking-config.js

assets/
  platform.css, platform-icons.js, platform-ui.js
  tracking.js

scripts/
  apply-supabase-migration.sh
  hub-agent/                        ← VPS worker

supabase/migrations/                ← 001–069

tests/                              ← 23 ficheiros, 153 testes
```

---

## 12. Variáveis de ambiente importantes

(Nomes típicos — ver `.env.example`)

- `METRICS_DASHBOARD_PASSWORD` — auth HUB/métricas/adm
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`, webhooks
- `META_ACCESS_TOKEN`, pixel IDs
- `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`
- `HUB_HANDOFF_SECRET` — handoff gestor comunidade
- `OPENAI_API_KEY` — screenshot vision, AI Agent
- VPS worker env — ver `scripts/hub-agent/worker.env.example`

---

## 13. INSTRUÇÕES PARA O GPT (ler isto)

O João quer **parar o ciclo passo-a-passo** no Cursor. Analisa este documento e devolve **um plano executável em blocos** para o Cursor Agent implementar de uma vez (ou em 2–3 blocos grandes, não 20 micro-fases).

### Formato de resposta pedido

```markdown
# Plano consolidado — HUB DR Ecoom

## Bloco A: [nome] (prioridade P0)
**Objectivo:** ...
**Ficheiros a tocar:** ...
**Tarefas:**
1. ...
2. ...
**Critério de done:** ...
**Testes:** ...

## Bloco B: ...
...

## Ordem de execução
A → B → C

## Riscos / não fazer
- ...

## Prompt para colar no Cursor (copy-paste)
[texto único que o João cola numa conversa nova]
```

### O GPT deve considerar

1. **Não quebrar Onda Prodígio** — conteúdo e checkout actual devem continuar a funcionar durante migração.
2. **Priorizar valor** — gestor consegue criar oferta nova + comunidade + vender, mesmo que funil ainda seja simples.
3. **Minimizar chat** — cada bloco = 1 sessão Cursor autónoma com critérios claros de done.
4. **Estado git** — assumir diff local por commitar; incluir commit message sugerida no fim de cada bloco.
5. **Testes** — manter `npm test` verde; adicionar testes só onde agregam valor.

### Perguntas que o GPT pode assumir (sem perguntar ao João)

- Stack: Node.js serverless Vercel + Supabase + Stripe; front vanilla JS.
- Idioma UI: PT-PT.
- Onda = referência; novas ofertas = canvas vazio.
- Métricas ficam no HUB; comunidade no domínio da oferta.

---

## 14. Prompt pronto para colar no GPT

```
Lê o documento docs/HANDOFF-GPT-ESTADO-COMPLETO-2026-08-21.md do projecto HUB DR Ecoom / Onda Prodígio.

Contexto: temos muito código (HUB, Page Engine, CMS comunidade, editor inline, Stripe/tracking multi-oferta) mas a Onda ainda corre em HTML legacy. O utilizador está cansado de implementar fase a fase no Cursor e quer um plano consolidado.

Com base no documento:
1. Confirma o que está realmente feito vs o que falta.
2. Propõe 3–5 BLOCOS de trabalho (não micro-tarefas) ordenados por prioridade.
3. Cada bloco deve ter: objectivo, ficheiros, tarefas numeradas, critério de done, testes.
4. Inclui um único prompt copy-paste para eu dar ao Cursor Agent executar o Bloco A completo.
5. Lista explicitamente o que NÃO fazer (ex: apagar módulos OP, reescrever tudo do zero).

Responde em PT-PT. Sê directo. Não asks clarifying questions — assume o documento como fonte de verdade.
```

---

## 15. Prompt pronto para colar no Cursor (depois do GPT)

```
Implementa o Bloco [X] do plano GPT anexo.

Regras:
- Ler docs/HANDOFF-GPT-ESTADO-COMPLETO-2026-08-21.md
- Não apagar conteúdo Onda Prodígio existente
- npm test deve passar no fim
- Diff mínimo e focado
- No fim: resumo do que mudou + o que falta do bloco

[P colar aqui o Bloco X que o GPT devolveu]
```

---

## 16. Histórico de entregas recentes (pós 18 Ago)

| Entrega | Ficheiros principais |
|---------|---------------------|
| CMS comunidade Fase 1 | `content-admin.js`, `adm/content.js`, tab Conteúdo |
| CMS Fase 2 | delete, editor lateral, uploads, migration 069 |
| Handoff gestor | `hub-admin-access.js`, `hub-enter.js` |
| Modo gestor UI | `comunidade/index.js`, barra admin |
| Fix iframe HUB | `lib/hub/modules.js`, `vercel.json` CSP |
| Métricas por oferta | `hub-metrics.js`, `metrics-overview.js`, UI hub |
| Meta multi-conta | `meta-accounts-store.js` |
| Apagar oferta | `delete-offer.js` |
| Domínios/definições activos | `offer-settings.js`, handlers |
| Design system HUB v2 | `assets/platform.*`, Fase 7A/7B |
| **Editor inline comunidade** | `content-editor.js`, integração index + produto |
| **Selector multi-programa** | `content-editor.js` v2 |

---

## 17. Cache busting (após deploy)

Hard refresh (`Cmd+Shift+R`). Versões actuais relevantes:

- `hub.js?v=30` (aprox — ver HTML)
- `comunidade/index.js?v=20260821c`
- `comunidade/produto.js?v=20260821d`
- `comunidade/content-editor.js?v=2`
- `adm/content.js?v=2`, `adm.css?v=6`

---

*Documento gerado para handoff João → GPT → Cursor. Actualizar quando houver commit/deploy significativo.*
