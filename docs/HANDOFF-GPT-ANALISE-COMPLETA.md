# Handoff completo — Onda Prodígio / HUB DR Ecoom

**Documento para análise externa (GPT ou outro)** — estado do projecto, lógica, design, gaps e oportunidades de melhoria.

**Data de referência:** 18 Agosto 2026  
**Autor do código:** sessões Cursor Agent (Angela / DR Ecoom)  
**Testes:** `npm test` → **130/130** a passar  
**Deploy produção:** Vercel projecto `onda-prodigio`

---

## Índice

1. [Resumo executivo](#1-resumo-executivo)
2. [URLs e credenciais operacionais](#2-urls-e-credenciais-operacionais)
3. [Visão de produto vs realidade técnica](#3-visão-de-produto-vs-realidade-técnica)
4. [Arquitectura global](#4-arquitectura-global)
5. [Design system actual](#5-design-system-actual)
6. [HUB — shell admin](#6-hub--shell-admin)
7. [Page Builder / Page Engine](#7-page-builder--page-engine)
8. [Funil legacy (Onda Prodígio)](#8-funil-legacy-onda-prodígio)
9. [Checkout e Stripe](#9-checkout-e-stripe)
10. [Tracking e atribuição](#10-tracking-e-atribuição)
11. [Comunidade e automações](#11-comunidade-e-automações)
12. [Métricas e admin](#12-métricas-e-admin)
13. [AI Agent e worker VPS](#13-ai-agent-e-worker-vps)
14. [Base de dados Supabase](#14-base-de-dados-supabase)
15. [API — rotas e acções](#15-api--rotas-e-acções)
16. [Domínios e routing](#16-domínios-e-routing)
17. [Integrações env vs BD](#17-integrações-env-vs-bd)
18. [Testes automatizados](#18-testes-automatizados)
19. [Fases implementadas (roadmap)](#19-fases-implementadas-roadmap)
20. [Pendências críticas](#20-pendências-críticas)
21. [Oportunidades de melhoria — LÓGICA](#21-oportunidades-de-melhoria--lógica)
22. [Oportunidades de melhoria — DESIGN / UX](#22-oportunidades-de-melhoria--design--ux)
23. [Prompts sugeridos para o GPT](#23-prompts-sugeridos-para-o-gpt)
24. [Índice de ficheiros](#24-índice-de-ficheiros)

---

## 1. Resumo executivo

**O que é:** Plataforma de vendas digitais para Angela Campos — Onda Prodígio, evoluindo para um **HUB multi-oferta** estilo Hotmart/Ticto (referência visual: Ticto, tom escuro roxo).

**O que funciona hoje em produção (Onda Prodígio):**
- Funil VSL (`funnel/`) + checkouts Stripe €9/€19
- Webhook Stripe → comunidade + CAPI Meta + GA4 + push métricas
- Área de membros Supabase (`comunidade/`)
- Email (Gmail) + WhatsApp (Evolution API) — recuperação e onboarding
- Dashboard métricas (`metricas/`) + admin membros (`adm/`)

**O que está construído mas ainda não é o runtime principal:**
- **HUB DR Ecoom** — shell com sidebar, home por oferta, 8 módulos
- **Page Engine** — funnels/pages/sections/blocks em Supabase + editor visual + renderer
- **Multi-oferta** — `hub_offers`, integrações, checkouts, tracking e Stripe por oferta (código wired, BD parcialmente aplicada)
- **AI Agent** — fila `ai_tasks` + worker VPS + MCP tools para manipular pages

**Conclusão honesta:** É um **funil sólido + automações** com uma **camada hub/page-builder avançada em código**, mas **1 oferta real** ainda corre em HTML estático. O HUB é o painel de convergência — falta fechar o circuito (migrations, métricas por oferta, funil legacy → Page Engine).

---

## 2. URLs e credenciais operacionais

| Superfície | URL |
|------------|-----|
| Funil público | https://onda-prodigio.vercel.app |
| HUB admin | https://hub-dr-ecoom.vercel.app |
| Checkout €9 | https://onda-prodigio.vercel.app/checkout9/ |
| Checkout €19 | https://onda-prodigio.vercel.app/checkout19/ |
| Métricas | https://onda-prodigio.vercel.app/metricas/ |
| Editor (exemplo) | `/editor/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page` |
| Page live (hub path) | `/p/{offer}/{funnel}/{page}` |
| Page live (domínio funil) | `https://{funnel_domain}/{funnel}/{page}` |

| Serviço | Valor |
|---------|-------|
| Supabase project | `vmyezkbkthguojmxhacw` |
| Supabase URL | `https://vmyezkbkthguojmxhacw.supabase.co` |
| Conta Supabase | `suporte.angelacampos@gmail.com` |

**Auth HUB / Editor / Métricas / Adm:** password única → env `METRICS_DASHBOARD_PASSWORD` (valor conhecido pela equipa: `Casca2020`). Token Bearer em `sessionStorage` key `onda-metrics-token`.

**Sem multi-user, sem roles, sem OAuth no HUB.**

---

## 3. Visão de produto vs realidade técnica

| Aspiração (Hotmart / Ticto) | Estado actual |
|-----------------------------|---------------|
| N ofertas isoladas | 1 oferta activa (`onda-prodigio`) + rascunhos criáveis no HUB |
| Funil visual por oferta | Page Engine **existe**; Onda ainda usa `funnel/index.html` estático |
| Checkout configurável | `checkout9/`/`checkout19/` estáticos; keys/preços **resolvíveis por oferta** via `stripe-client.js` |
| Métricas por oferta | Dashboard **global**; `?offer=` no iframe **não filtra** dados |
| Tracking por oferta | **Webhook CAPI** usa metadata; **client** usa `/api/tracking-config?offer=`; legacy pages nem sempre têm `data-offer-slug` |
| Domínio próprio automático | BD + routing **feitos**; DNS Vercel **manual** |
| Área membros por oferta | Comunidade ligada a `products` Supabase, não a `hub_offers` |
| Wizard criar oferta | Só form card “Nova oferta” (nome + domínio opcional) |
| Design premium unificado | HUB + editor + checkout **dark roxo Ticto-like**; pages publicadas **light Inter** por defeito |

---

## 4. Arquitectura global

```mermaid
flowchart TB
    subgraph Publico["Superfície pública"]
        VSL[funnel/ VSL]
        CK9[checkout9/19]
        PE[Page Renderer /p/ ou domínio]
        COM[comunidade/]
    end

    subgraph Hub["HUB DR Ecoom"]
        HUI[hub/index.html + hub.js]
        ED[hub/editor.html + editor.js]
    end

    subgraph API["Vercel Serverless"]
        SA[sales-attribution.js monolith]
        STR[stripe-webhook.js]
        CFG[config.js + create/update PI]
        TC[tracking-config.js]
        COM_API[comunidade/[[...slug]].js]
    end

    subgraph Data["Supabase Postgres"]
        HO[hub_offers + integrations]
        FE[funnels pages sections blocks]
        AI[ai_tasks + tool_calls]
        REV[page_revisions]
        MB[products modules members]
    end

    subgraph External["Externos"]
        ST[Stripe]
        META[Meta CAPI]
        VPS[AI Worker VPS]
    end

    HUI --> SA
    ED --> SA
    VSL --> CFG
    CK9 --> CFG
    CK9 --> STR
    PE --> SA
    SA --> HO
    SA --> FE
    STR --> META
    VPS --> SA
    VPS --> FE
```

**Stack:** HTML/CSS/JS estático + Node serverless + Supabase + Stripe + Meta + Stape + Evolution WhatsApp.

**Limite Vercel Hobby:** 12 functions — API HUB embutida em `api/sales-attribution.js` (~650+ linhas de acções).

**Dependências npm:** `@supabase/supabase-js`, `stripe`, `nodemailer`, `web-push`, `micro`.

---

## 5. Design system actual

**Referência:** Ticto (formas arredondadas, confiança, roxo vibrante) — **preferência do cliente: tom escuro**.

**Fonte partilhada:** `Plus Jakarta Sans` (Google Fonts) — HUB, editor, checkout.

### Tokens HUB (`hub/hub.css?v=10`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--hub-bg` | `#0c0a12` | Fundo app |
| `--hub-panel` | `#181522` | Cards, sidebar panels |
| `--hub-text` | `#f4f2f8` | Texto principal |
| `--hub-muted` | `#9490a8` | Secundário |
| `--hub-accent` | `#a855f7` | Links, active states |
| `--hub-gradient` | `#7c3aed → #c084fc` | CTAs primários |
| `--hub-success` | `#34d399` | Live / ok |
| `--hub-radius` | `18px` | Cards |

**Padrões UI HUB:**
- Login split (hero + card) com trust list
- Sidebar fixa com grupos Marketing / Vendas / Automação / Plataforma + ícones emoji
- Home oferta: onboarding 4 passos + quick actions
- Lista ofertas: hero + cards com avatar inicial + badge estado

### Tokens Editor (`hub/editor.css?v=2`, prefixo `--peb-*`)

Mesma paleta; layout 3 colunas: sidebar 284px | canvas | inspector 320px; topbar 58px blur.

### Tokens Checkout (`checkout9/checkout.css?v=2`, prefixo `--ck-*`)

Mesmo dark; painéis `#181522`; CTA gradiente roxo; barra escassez gradiente roxo (antes vermelho); pills 🔒 SSL · 💳 Stripe · ✓ Garantia.

### Pages publicadas (Page Renderer)

**Intencionalmente diferente:** fundo branco, `Inter`, botões `#6366f1` — **não usa** `hub_offers.branding` ainda.

### Inconsistências de design conhecidas

- Métricas/adm/comunidade: UI própria (não rebranded)
- Funil legacy VSL: design antigo
- Mix PT-PT / EN no editor (Undo, Save, Publish)
- Sidebar usa emoji — não icon set SVG
- Published pages vs admin: light vs dark sem transição intencional documentada

---

## 6. HUB — shell admin

### Ficheiros

| Ficheiro | Versão cache | Função |
|----------|--------------|--------|
| `hub/index.html` | — | Shell HTML |
| `hub/hub.js` | v14 | Lógica navegação, módulos, ofertas |
| `hub/hub.css` | v10 | Design system |
| `hub/hub-ai.js` | v1 | UI módulo AI Agent |

### Módulos (`lib/hub/modules.js`)

| ID | Label | Tipo | URL |
|----|-------|------|-----|
| `ai-agent` | AI Agent | painel interno | `/ai-agent?offer=` |
| `dashboard` | Dashboard | **iframe** metricas | `/metricas/?offer=&embed=1` |
| `tracking` | Tracking | painel interno | `/tracking?offer=` |
| `recupera` | Recupera | painel interno | `/recupera?offer=` |
| `impulsiona` | Impulsiona | painel interno | `/impulsiona?offer=` |
| `comunidade` | Comunidade | **iframe** adm | `/adm/?offer=&embed=1` |
| `integracoes` | Integrações | formulário | `/integracoes?offer=` |
| `funil` | Funil | lista funnels/pages + links editor | `/funil?offer=` |

**Draft offers:** maioria módulos `soon`; dashboard/comunidade bloqueados até `status === 'active'`.

### Fluxo `hub.js`

```
Login (password → token sessionStorage)
  → GET hub_offers
  → [lista] click oferta → openOffer(slug)
      → GET hub_offer
      → view HOME (onboarding + quick grid)
      → sidebar NAV_GROUPS
      → click módulo → GET hub_module → render panel OR iframe embed
  → deep link: ?offer=&module= | /funil?offer= | sessionStorage hub-nav-intent
  → criar oferta: POST hub_create_offer
```

### Onboarding (home)

4 passos calculados em `computeOnboardingSteps()`:

1. Oferta criada — sempre ✓  
2. Integrações — **`offer.status === 'active'`** (proxy fraco; não verifica keys reais)  
3. Funil live — módulo `funil` status live  
4. Tracking live — módulo `tracking` status live  

### Dados de módulo

`lib/hub/module-data.js` — payloads por módulo (health tracking, filas WhatsApp, campos integração, lista funnels, tasks AI).

---

## 7. Page Builder / Page Engine

### Modelo de dados

```
hub_offers
  └── funnels (slug, type, status)
        └── pages (slug, status draft|published, settings JSON)
              └── page_sections (type, sort_order, settings)
                    └── page_blocks (type, content, settings, styles)
```

**Block types:** `heading`, `text`, `image`, `video`, `button`, `spacer`, `html`

**Migration:** `065_funnel_engine.sql` + triggers integridade `offer_id` cross-table.

### Editor — ficheiros

| Ficheiro | Função |
|----------|--------|
| `hub/editor.html` | Shell |
| `hub/editor.js` | Estado, save, publish, autosave, revisions, undo/redo |
| `hub/editor-dnd.js` | Drag-and-drop |
| `hub/editor-ai.js` | Painel AI (local + agent) |
| `hub/editor-screenshot.js` | Upload screenshot → vision |

### Funcionalidades

| Feature | Implementação | Ficheiro-chave |
|---------|---------------|----------------|
| Load tree | `hub_page_tree` | `handlers/page-builder.js` |
| Save mutations | diff → funnel-engine | `page-builder/save.js` |
| Autosave | debounce 2.5s, silent | `editor.js` |
| Publish | status + snapshot revision | `page-builder/publish.js` |
| Revisions | max 30, restore | `page-builder/revisions.js` + migration 067 |
| Templates | 4 sections, 3 pages | `templates/catalog.js` |
| AI local | regex heading/text/button | `ai-assistant.js` |
| AI agent | fila ai_tasks | `hub_page_builder_ai_agent` |
| Screenshot | OpenAI Vision | `screenshot/analyze.js` |
| Preview | `/preview/...?preview=1` | `handlers/page-preview.js` |
| Live URL | `/p/...` ou domínio funil | `urls.js`, `page-domain.js` |

### Renderer

`lib/hub/page-renderer/` — HTML completo, escape XSS, visibility responsive, inject `tracking.js` + `data-offer-slug` em produção.

**Defaults page:** maxWidth 960px, bg `#ffffff`, font Inter.

---

## 8. Funil legacy (Onda Prodígio)

| Path | Conteúdo |
|------|----------|
| `funnel/index.html` | VSL VTurb embed |
| `assets/tracking-vsl.js` | Eventos VSL |
| `vsl19/` | Variante €19 |

**Não passa pelo Page Engine.** Checkout links hardcoded para `/checkout9/` ou `/checkout19/`.

---

## 9. Checkout e Stripe

### Fluxo actual

```
Browser checkout9/checkout.js
  → GET /api/config (?checkout=, host → offer)
  → POST /api/create-payment-intent (tracking + offer metadata)
  → Stripe.js Payment Element
  → POST /api/update-payment-intent (bumps, CAPI funnel events)
  → Stripe webhook payment_intent.succeeded
      → CAPI Purchase (offer from metadata)
      → grant-access comunidade
      → push métricas
```

### Multi-oferta (`lib/hub/stripe-client.js`) — Fase 6B

**Resolução oferta:** body/query slug → tracking → Host → default `onda-prodigio`.

**Dados:** `hub_offer_integrations` (keys) + `hub_offer_checkouts` (amount, price_id, paths).

**APIs wired:** `config.js`, `create-payment-intent.js`, `update-payment-intent.js`, `stripe-webhook.js` (multi-secret).

**Ainda global:** upsell checkout sessions, métricas Stripe list, PMC IDs env.

### Checkouts seed (migration 060)

| checkout_id | Valor | Path |
|-------------|-------|------|
| `checkout9` | 900 cents | `/checkout9/` |
| `checkout19` | 1900 cents | `/checkout19/` |

---

## 10. Tracking e atribuição

### Por oferta (`lib/tracking/offer-tracking.js`)

- Server: pixel, CAPI token, GA4, GTM, Stape from BD → env fallback  
- Client: `/api/tracking-config?offer=` ou Host  
- Webhook: `resolveServerTrackingFromMetadata({ offer_slug })`

### Client (`assets/tracking.js`)

PageView, Lead, InitiateCheckout, Purchase; `getStripeTrackingMetadata()` envia `offer_id`/`offer_slug`.

### UTM Meta (regra projecto)

```
utm_source=facebook&utm_medium=paid&utm_content={{ad.name}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}
```

---

## 11. Comunidade e automações

| Área | Path | Notas |
|------|------|-------|
| Membros | `comunidade/` + `api/comunidade/` | Supabase Auth |
| Grant access | `lib/comunidade/grant-access.js` | Webhook Stripe |
| Recupera pagamento | `lib/comunidade/failed-payment-recovery-queue.js` | WhatsApp queue |
| Email | `lib/email/` | Gmail SMTP |
| WhatsApp | `lib/whatsapp/` | Evolution API |

**Não multi-oferta:** grant-access usa product global `onda-prodigio`.

---

## 12. Métricas e admin

| Superfície | Path | Auth |
|------------|------|------|
| Dashboard | `metricas/` | mesma password |
| Admin | `adm/` | mesma password |

**Stripe report:** `lib/metrics/stripe-sales.js` — env `STRIPE_SECRET_KEY` global.

**Meta report:** `lib/meta-ads/` — contas env; `hub_offer_meta_accounts` **não wired**.

**Embed HUB:** iframe com `?embed=1` — CSS adapta margens.

---

## 13. AI Agent e worker VPS

### Fila Supabase

- `ai_tasks` (063) — status pending/running/completed/failed  
- `ai_task_tool_calls` (066) — log MCP  
- `claim_next_ai_task(worker_id)` — claim atómico  

### Worker

`scripts/hub-agent/worker/poll-tasks.js` — poll → Cursor Agent → MCP `hub-page-tools-server.js`

**Tools allowlist:** get/create/update funnel, page, section, block, reorder, get_page_tree (ver `lib/hub/agent-tools/registry.js`).

**Workspace:** `/opt/hub-agent/workspaces/{agent_workspace_key}` branch `agent_branch`.

**Docs ops:** `docs/VPS-CURSOR-AGENT-CONTABO.md`

---

## 14. Base de dados Supabase

### Migrations hub platform (060–067) — **verificar se aplicadas em prod**

| Ficheiro | Conteúdo |
|----------|----------|
| `060_hub_offers.sql` | offers, meta_accounts, checkouts, integrations, event_log |
| `061_hub_offer_domains.sql` | funnel_domain, hub_domain, domains table |
| `062_hub_domain_vercel.sql` | hub → hub-dr-ecoom.vercel.app |
| `063_ai_tasks.sql` | fila AI |
| `064_offer_context.sql` | agent_workspace_key, ai-test-offer seed |
| `065_funnel_engine.sql` | funnels, pages, sections, blocks |
| `066_ai_task_tool_calls.sql` | observability MCP |
| `067_page_revisions.sql` | histórico versions (**UI pronta, migration pendente**) |

**Aplicar:** `./scripts/apply-supabase-migration.sh supabase/migrations/NNN_nome.sql`

### Migrations legacy (001–059)

Comunidade, módulos Onda/Clube, WhatsApp queues, comentários AI, push PWA, etc.

---

## 15. API — rotas e acções

### Serverless (12 functions max)

| Ficheiro | Role |
|----------|------|
| `api/sales-attribution.js` | **Monolith** hub + métricas + admin + page builder |
| `api/stripe-webhook.js` | Webhooks Stripe |
| `api/comunidade/[[...slug]].js` | Router comunidade |
| `api/create-payment-intent.js` | PI create |
| `api/update-payment-intent.js` | PI update |
| `api/config.js` | Stripe public config |
| `api/tracking-config.js` | Tracking public config |
| `api/verify-payment.js` | Verify PI |
| `api/create-upsell-checkout.js` | Upsell sessions |
| `api/bootstrap-tracking.js` | Setup webhook |
| `api/replay-purchase.js` | Replay CAPI |
| `api/meta-tracking-status.js` | Meta health |

### Acções HUB em `sales-attribution.js`

**GET:** `hub_offers`, `hub_offer`, `hub_health`, `hub_module`, `hub_ai_task`, `hub_ai_tasks`, `hub_page_tree`, `hub_funnel_list`, `hub_page_list`, `hub_page_templates`, `hub_page_revisions`, `hub_page_preview`, `hub_page_domain`

**POST:** `hub_create_offer`, `hub_save_integrations`, `hub_import_integrations`, `hub_ai_task_create`, `hub_page_builder_save`, `hub_page_builder_publish`, `hub_page_builder_ai`, `hub_page_builder_ai_agent`, `hub_page_builder_screenshot`, `hub_page_template_materialize`, `hub_page_revision_restore`, `hub_page_render`, `hub_page_builder_cross_offer`

**Públicos (sem auth):** `hub_page_preview`, `hub_page_domain`

---

## 16. Domínios e routing

Ver `vercel.json`:

- Hub host → `/hub/index.html` + SPA paths  
- Funnel host `/` → `funnel/index.html`  
- `/editor/:offer/:funnel/:page` → editor  
- `/p/:offer/:funnel/:page` → preview published  
- `/:funnel/:page` on funnel host → `hub_page_domain`  

**Reserved paths:** checkout9, comunidade, api, metricas, etc. (`domain-routing.js`)

---

## 17. Integrações env vs BD

`lib/hub/integration-keys.js` define keys por grupo: tracking, stripe, gmail, whatsapp, vturb, supabase.

**Resolução:** `offers.getOfferIntegrations(offerId)` — BD first, env fallback.

| Área | BD wired runtime? |
|------|-------------------|
| Tracking CAPI webhook | ✅ metadata → offer |
| Tracking client Page Engine | ✅ data-offer-slug |
| Stripe PI create | ✅ stripe-client |
| Métricas Stripe/Meta | ❌ global env |
| Email/WhatsApp | ❌ global env |
| Comunidade product | ❌ global |

**UI integrações HUB:** grava `hub_offer_integrations`; import copia env → BD.

---

## 18. Testes automatizados

```bash
npm test   # node --test tests/**/*.test.js
```

**130 testes**, 14 ficheiros — unitários, in-memory funnel engine, sem E2E browser.

| Ficheiro | Focus |
|----------|-------|
| `page-builder.test.js` | Editor mutations |
| `page-renderer.test.js` | HTML output |
| `funnel-engine.test.js` | CRUD + isolation |
| `agent-tools.test.js` | MCP executor |
| `stripe-multi-offer.test.js` | stripe-client |
| `tracking-offer-runtime.test.js` | offer-tracking |
| `page-builder-revisions.test.js` | revisions |
| outros | domains, publish, templates, screenshot, AI |

**Gaps:** E2E, live Supabase, UI HUB, webhook integration tests.

---

## 19. Fases implementadas (roadmap)

| Fase | Doc | Estado |
|------|-----|--------|
| 1 | FASE-1-AI-TASK-INFRASTRUCTURE | ✅ código |
| 2 | FASE-2-OFFER-CONTEXT | ✅ código |
| 3A | FASE-3A-FUNNEL-PAGE-ENGINE | ✅ código |
| 3B | FASE-3B-PAGE-RENDERER | ✅ código |
| 3C | FASE-3C-AI-PAGE-MANIPULATION | ✅ MCP + tools |
| 4A–E | FASE-4* | ✅ builder, DnD, templates, AI, screenshot |
| 5A–E | FASE-5* | ✅ publish, autosave, revisions*, domains, tracking runtime |
| 6A | FASE-6A-HUB-SHELL | ✅ sidebar + home |
| 6B | FASE-6B-STRIPE-MULTI-OFFER | ✅ stripe-client wired |
| 6C+ | — | métricas nativas, wizard, design unificado pages |

\* revisions UI pronta; migration 067 por aplicar.

---

## 20. Pendências críticas

1. **Aplicar migrations 060–067** no Supabase produção  
2. **Migration 067** — senão histórico editor falha em prod  
3. **Métricas filtradas por oferta** — dashboard iframe é cosmetic  
4. **Validar worker VPS** end-to-end com MCP  
5. **Funil Onda → Page Engine** ou documentar dual-run  
6. **Comunidade multi-oferta** — `primary_product_id` + host routing  
7. **Vercel 12-function limit** — monolith insustentável long-term  
8. **Domínios custom** — wizard DNS + verificação  

---

## 21. Oportunidades de melhoria — LÓGICA

### Prioridade alta

1. **OfferContext único** — toda entrada (API, webhook, renderer, metricas) resolve oferta da mesma forma  
2. **Provisionar oferta nova** — ao criar: funnel default + page welcome + import integrações template + checkouts rows  
3. **Onboarding real** — verificar keys non-empty em integrações, não só `status active`  
4. **Métricas por oferta** — Stripe filter `metadata.offer_slug`; Meta por `hub_offer_meta_accounts`  
5. **Split sales-attribution** — Vercel Pro ou edge router por `action` prefix  
6. **Grant-access por oferta** — metadata → product_id mapping  
7. **E2E smoke** — publish page → live URL → tracking config → test PI  

### Prioridade média

8. Upsell checkout sessions per offer  
9. Impulsiona sequences (hoje placeholder)  
10. Cron recovery sem depender de triggers manuais  
11. Cross-offer analytics no HUB home (vendas 7d placeholder)  
12. Editor conflict detection se duas tabs  
13. Webhook Stripe multi-conta — documentar setup `?offer=slug`  

### Prioridade baixa / dívida técnica

14. Remover `._*` macOS artifacts em `lib/hub/agent-tools/`  
15. Cache offers TTL 30s — invalidation hooks  
16. Rate limit hub API  
17. Structured logging hub_event_log usage  

---

## 22. Oportunidades de melhoria — DESIGN / UX

### Prioridade alta

1. **Unificar branding** — `hub_offers.branding.accent` → page-renderer + checkout theme vars  
2. **Rebrand metricas + adm + comunidade** — mesmo tokens `--hub-*` ou shared `assets/platform.css`  
3. **Funil legacy VSL** — wrapper dark ou landing template Page Engine  
4. **Wizard criar oferta** — multi-step: nome → domínio → Stripe → tracking → primeira page  
5. **Empty states** — funil sem pages, integrações vazias, métricas sem dados  
6. **Icon system** — substituir emoji sidebar por SVG consistente  

### Prioridade média

7. **Editor UX** — traduzir EN→PT; melhorar mobile inspector  
8. **Checkout** — A/B theme per offer; manter dark como default DR Ecoom  
9. **Trust signals** — selos reutilizáveis componente block `trust-badges`  
10. **Loading skeletons** — HUB list/home/module  
11. **Toast system** — unificar status hub.js / editor.js  
12. **Offer card** — preview thumbnail última page publicada  

### Prioridade baixa

13. Light mode toggle operador  
14. Animações micro-interacções (Framer-level subtle)  
15. Logo DR Ecoom SVG em vez “DR” text  
16. Accessibility audit WCAG AA dark purple  

### Referência Ticto (o que replicar)

- Confiança: selos pagamento, números sociais, copy claro  
- Simplicidade: poucas cores, roxo só em CTA  
- Cards generosos, whitespace, bordas 14–18px  
- Dashboard “vendas em tempo real” — aspiracional para métricas HUB  

---

## 23. Prompts sugeridos para o GPT

### Prompt A — Auditoria lógica completa

```
Analisa o projecto Onda Prodígio / HUB DR Ecoom com base em docs/HANDOFF-GPT-ANALISE-COMPLETA.md.

1. Lista bugs lógicos e race conditions (autosave, publish, webhook, offer resolution).
2. Propõe ordem de implementação para fechar gap Hotmart/Ticto (migrations → métricas → wizard).
3. Para cada item P0, indica ficheiros exactos a alterar e riscos de regressão.
4. Sugere refactor de sales-attribution.js compatível com Vercel Hobby ou justifica upgrade Pro.

Responde em PT-PT, tabelas prioritizadas P0/P1/P2.
```

### Prompt B — Auditoria design / UX

```
Com base em docs/HANDOFF-GPT-ANALISE-COMPLETA.md secção 5 e 22, e referência Ticto (plataforma vendas BR):

1. Define design tokens partilhados (CSS variables) para hub + editor + checkout + metricas.
2. Propõe wireframes textuais: login HUB, home oferta, editor, checkout dark.
3. Lista inconsistências actuais e fix por ficheiro CSS.
4. Como aplicar branding por oferta nas pages publicadas sem quebrar conversão?

Tom escuro roxo, Plus Jakarta Sans, confiança profissional.
```

### Prompt C — Plano 30 dias

```
Projecto: HUB multi-oferta Onda Prodígio. Estado em HANDOFF-GPT-ANALISE-COMPLETA.md.
Objectivo: 2 ofertas a vender com funil Page Engine, métricas isoladas, design coerente.

Cria roadmap 30 dias (semana a semana) com entregáveis testáveis e critérios de done.
Assume 1 developer + Cursor Agent. Migrations Supabase no início.
```

### Prompt D — Migrar funil legacy

```
O funil actual é funnel/index.html (VTurb). Page Engine está em lib/hub/funnel-engine + page-renderer.

Propõe migração incremental: manter VSL VTurb como block video na page, checkout links configuráveis por block button, tracking data-offer-slug=onda-prodigio.

Detalha passos, ficheiros, rollback plan.
```

---

## 24. Índice de ficheiros

### HUB frontend
```
hub/index.html
hub/hub.js
hub/hub.css
hub/hub-ai.js
hub/editor.html
hub/editor.js
hub/editor.css
hub/editor-dnd.js
hub/editor-ai.js
hub/editor-screenshot.js
```

### HUB backend
```
lib/hub/modules.js
lib/hub/offers.js
lib/hub/offer-context.js
lib/hub/stripe-client.js
lib/hub/integration-keys.js
lib/hub/integrations-store.js
lib/hub/module-data.js
lib/hub/ai-tasks.js
lib/hub/funnel-engine/
lib/hub/page-builder/
lib/hub/page-renderer/
lib/hub/agent-tools/
lib/hub/handlers/
```

### API
```
api/sales-attribution.js
api/stripe-webhook.js
api/config.js
api/create-payment-intent.js
api/update-payment-intent.js
api/tracking-config.js
api/comunidade/[[...slug]].js
```

### Tracking & Stripe
```
lib/tracking/offer-tracking.js
lib/tracking/server-events.js
lib/tracking/meta-capi.js
assets/tracking.js
lib/stripe-env.js
lib/funnel-checkout-config.js
```

### Checkout & funil
```
checkout9/  checkout19/  checkout9-test/
funnel/  vsl19/  obgd/
```

### Tests & docs
```
tests/*.test.js          (14 files, 130 tests)
docs/FASE-*.md           (fases 1–6)
docs/RELATORIO-PROJECTO-HUB.md
docs/HANDOFF-GPT-ANALISE-COMPLETA.md  (este ficheiro)
```

### Infra
```
vercel.json
.env.example
supabase/migrations/
scripts/apply-supabase-migration.sh
scripts/hub-agent/
```

---

## Variáveis de ambiente (referência rápida)

Ver `.env.example` completo. Grupos críticos:

| Grupo | Vars |
|-------|------|
| Auth | `METRICS_DASHBOARD_PASSWORD`, `BOOTSTRAP_SECRET` |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID*`, `STRIPE_AMOUNT_CENTS*` |
| Meta | `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_REPORTING_CURRENCY` |
| GA4/GTM | `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `GTM_*`, `SERVER_CONTAINER_URL` |
| Email/WA | `GMAIL_*`, `EVOLUTION_*`, `WHATSAPP_ENABLED` |
| AI | `OPENAI_API_KEY`, `OPENAI_VISION_MODEL` |
| Worker | `WORKER_ID`, `HUB_AGENT_WORKSPACES_ROOT`, `AGENT_PATH` |

---

*Fim do handoff. Actualizar este documento quando migrations forem aplicadas, métricas por oferta forem wired, ou design system for unificado.*
