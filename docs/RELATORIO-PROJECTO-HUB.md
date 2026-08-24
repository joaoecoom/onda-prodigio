# Relatório do projecto — Onda Prodígio / HUB DR Ecoom

**Estado:** 17 Agosto 2026  
**Objectivo do documento:** Mapa completo do projecto para discussão estratégica (visão Hotmart vs. realidade técnica).  
**Projecto Supabase produção:** `vmyezkbkthguojmxhacw`  
**Deploy:** Vercel (`onda-prodigio` / `hub-dr-ecoom.vercel.app`)

---

## Índice

1. [Visão vs. realidade](#1-visão-vs-realidade)
2. [Arquitectura técnica](#2-arquitectura-técnica)
3. [Domínios e routing](#3-domínios-e-routing)
4. [Superfícies frontend](#4-superfícies-frontend)
5. [API (serverless)](#5-api-serverless)
6. [Base de dados Supabase](#6-base-de-dados-supabase)
7. [Organização lib/](#7-organização-lib)
8. [O que funciona de verdade (Onda Prodígio)](#8-o-que-funciona-de-verdade-onda-prodígio)
9. [HUB DR Ecoom — estado actual](#9-hub-dr-ecoom--estado-actual)
10. [Integrações: env vs. BD](#10-integrações-env-vs-bd)
11. [Email, WhatsApp e automações](#11-email-whatsapp-e-automações)
12. [Stripe](#12-stripe)
13. [Tracking (Pixel, CAPI, GA4, Stape)](#13-tracking-pixel-capi-ga4-stape)
14. [Gaps para ser tipo Hotmart](#14-gaps-para-ser-tipo-hotmart)
15. [Mapa de dependências](#15-mapa-de-dependências)
16. [Variáveis de ambiente críticas](#16-variáveis-de-ambiente-críticas)
17. [Scripts e ops](#17-scripts-e-ops)
18. [Resumo executivo](#18-resumo-executivo)
19. [Prompts sugeridos para próximas fases](#19-prompts-sugeridos-para-próximas-fases)
20. [Ficheiros-chave](#20-ficheiros-chave)

---

## 1. Visão vs. realidade

| O que se quer (tipo Hotmart / Kiwify admin) | O que existe hoje |
|---------------------------------------------|-------------------|
| Plataforma central para N ofertas | **1 oferta real** (Onda Prodígio) + criar rascunhos vazios |
| Funil, checkout, domínio próprio por oferta | Funil **hardcoded** em HTML/JS; domínios na BD mas **não provisionados automaticamente** |
| Métricas por oferta | Dashboard **global** (env Stripe + Meta) |
| Tracking configurável por oferta | Pixel/CAPI/GA4/Stape **100% env global** |
| Comunidade por produto/oferta | Comunidade **funcional** mas ligada a `products` Supabase, não ao hub |
| Integrações por oferta | UI para **guardar na BD** — runtime **ainda lê env** |
| Email/ZAP automations | **Funcionam** para Onda (compra, falhados, nunca entrou) |
| Hub como produto acabado | **Shell** com cards + iframes + painéis de leitura |

**Conclusão:** O projecto é hoje um **funil + comunidade + automações sólidas para a Onda Prodígio**, com uma **camada hub multi-oferta iniciada mas não integrada no runtime**. Parece “arcaico” porque são peças coladas, não um produto único.

---

## 2. Arquitectura técnica

```
Stack:   HTML/CSS/JS estático + Vercel Serverless (Node) + Supabase Postgres + Stripe + Meta + Stape
Deploy:  Vercel (projecto onda-prodigio)
BD:      Supabase vmyezkbkthguojmxhacw
Auth:    Password única METRICS_DASHBOARD_PASSWORD (hub + métricas + adm)
Limite:  12 serverless functions (Vercel Hobby) — API hub embutida em sales-attribution.js
Deps:    @supabase/supabase-js, stripe, nodemailer, web-push, micro
```

### Estrutura de pastas (top-level)

| Pasta | Propósito |
|-------|-----------|
| `api/` | Rotas serverless Vercel |
| `lib/` | Lógica backend partilhada (hub, comunidade, tracking, Stripe, email, WhatsApp, métricas) |
| `hub/` | HUB DR Ecoom — shell admin multi-oferta |
| `metricas/` | Dashboard interno (PWA push vendas) |
| `adm/` | Admin membros (grant/revoke, reenvios) |
| `funnel/` | VSL principal (`index.html`) |
| `comunidade/` | Área de membros (login, produto, perfil, surveys) |
| `checkout9/`, `checkout19/`, `checkout9-test/` | Páginas checkout Stripe |
| `vsl19/` | VSL alternativa €19 |
| `obgd/`, `obgd-test/` | Obrigado + upsells |
| `comprar/` | Checkout standalone `/comprar/:productId` |
| `assets/` | JS partilhado (`tracking.js`, `tracking-vsl.js`), imagens |
| `supabase/migrations/` | 62 migrations SQL (001–062) |
| `scripts/` | Ops (migrations, Stripe, WhatsApp, Stape/GTM) |
| `reports/` | Análises estratégicas markdown |
| `.github/workflows/` | Cron AI comentários |
| `docker-compose.whatsapp.yml` | Stack Evolution API (WhatsApp) |
| `vercel.json` | Routing, rewrites, headers, timeouts |

---

## 3. Domínios e routing

Ficheiro: `vercel.json`

| Host | `/` serve | Notas |
|------|-----------|-------|
| `hub-dr-ecoom.vercel.app` | `/hub/index.html` | Hub; rotas `/tracking`, `/recupera`, etc. → hub SPA |
| `onda-prodigio.vercel.app` | `/funnel/index.html` | Funil VSL + resto do site |
| `onda-prodigio.vercel.app/hub` | Redirect → `hub-dr-ecoom.vercel.app` | |
| Default (sem host match) | `/funnel/index.html` | |

**Outros rewrites:** `/checkout9`, `/checkout19`, `/vsl19`, `/obgd/*`, `/comunidade/*`, `/metricas/*`, `/adm/*`, `/comprar/:productId`

**Headers:** segurança global; no-cache para PWA métricas  
**Functions com timeout 60s:** `stripe-webhook.js`, `comunidade/[[...slug]].js`

**Domínios na BD (migration 061–062):**
- Funil Onda: `onda-prodigio.vercel.app`
- Hub: `hub-dr-ecoom.vercel.app` (antes `hub.dr.ecoom.pt` na 061)

---

## 4. Superfícies frontend

| Pasta | URL | Função | Maturidade |
|-------|-----|--------|------------|
| `hub/` | hub host `/` | Admin multi-oferta | 🟡 Shell |
| `funnel/` | `/` (funil host) | VSL principal VTurb | 🟢 Live |
| `checkout9/`, `checkout19/` | `/checkout9`, `/checkout19` | Pagamento Stripe PI | 🟢 Live |
| `obgd/` | `/obgd` | Obrigado + upsells | 🟡 Upsells gated |
| `comunidade/` | `/comunidade/*` | Área membros | 🟢 Live |
| `metricas/` | `/metricas` | Dashboard interno | 🟢 Live (single-tenant) |
| `adm/` | `/adm` | Admin membros | 🟢 Live (single-tenant) |
| `comprar/` | `/comprar/:id` | Checkout standalone | 🟢 Live |

### Hub (`hub/`)
- Ficheiros: `index.html`, `hub.js`, `hub.css`
- Fluxo: login → lista ofertas → módulos por oferta
- Auth: token `onda-metrics-token` (sessionStorage)
- API: `/api/sales-attribution?action=hub_*`
- **Não auto-abre** última oferta (entrada = lista)

### Métricas (`metricas/`)
- Dashboard Stripe + Meta multi-conta + VTurb + ROAS + falhados
- PWA Web Push alertas venda
- `/metricas/analise` — análise campanhas
- `?embed=1` — modo iframe hub (esconde nav/logout)
- `?offer=` passado pelo hub mas **backend não filtra**

### Admin (`adm/`)
- Membros, grant/revoke, criar manual, reenviar credenciais
- Token unificado com hub (`onda-metrics-token`)
- `?embed=1` — modo iframe hub

### Comunidade (`comunidade/`)
- Páginas: login, produto, perfil, redefinir-password, respostaquestionario
- Supabase Auth client-side; config via `/api/comunidade/config`
- Conteúdo: módulos, aulas, progresso drip, comentários, surveys
- Muitas migrations de conteúdo Onda + Clube (PDFs, YouTube, etc.)

### Funil (`funnel/`)
- VSL + VTurb player
- Carrega `/assets/tracking.js` e `tracking-vsl.js`

---

## 5. API (serverless)

**Limite Vercel Hobby: 12 functions.** Lista actual:

| Ficheiro | Método | Função |
|----------|--------|--------|
| `api/sales-attribution.js` | GET/POST | **Monólito:** métricas + admin + API hub |
| `api/stripe-webhook.js` | POST | Webhook Stripe |
| `api/comunidade/[[...slug]].js` | * | Router comunidade |
| `api/create-payment-intent.js` | POST | Criar PaymentIntent |
| `api/update-payment-intent.js` | POST | Actualizar PI + eventos Meta funil |
| `api/verify-payment.js` | GET | Verificar pagamento |
| `api/create-upsell-checkout.js` | POST | Upsells Stripe Checkout |
| `api/config.js` | GET | Config pública Stripe |
| `api/tracking-config.js` | GET | Config pública tracking |
| `api/bootstrap-tracking.js` | POST | Setup webhook Stripe |
| `api/replay-purchase.js` | POST | Replay CAPI |
| `api/meta-tracking-status.js` | GET | Health Meta |

### `api/sales-attribution.js` — acções

**Auth:** `Authorization: Bearer` + `METRICS_DASHBOARD_PASSWORD` ou `BOOTSTRAP_SECRET`

**GET `?action=`**

| Action | Função |
|--------|--------|
| `stripe` (default) | Relatório Stripe |
| `combined` | Stripe + Meta |
| `meta` | Insights Meta |
| `meta_health` | Token + contas Meta |
| `meta_accounts` | Contas configuradas |
| `sales_pulse` | Polling vendas live |
| `admin_members` | Lista membros |
| `admin_never_logged_in_whatsapp_targets` | Targets WhatsApp |
| `admin_failed_payments` | Pagamentos falhados |
| `push_config` / `push_test` | Web Push |
| `hub_offers` | Listar ofertas |
| `hub_offer` | Detalhe oferta + módulos |
| `hub_health` | Health hub |
| `hub_module` | Dados painel módulo (tracking, recupera, etc.) |

**POST `?action=`**

| Action | Função |
|--------|--------|
| `meta_status` | Actualizar status Meta |
| `push_subscribe` / `push_unsubscribe` | Push |
| `setup_checkout19_price` | Criar preço €19 Stripe |
| `admin_grant` / `admin_revoke` | Acesso produtos |
| `admin_resend_email` | Reenviar email compra |
| `admin_resend_never_logged_in` | Bulk nunca entrou |
| `admin_send_next_never_logged_in_whatsapp` | Processar fila WhatsApp |
| `admin_send_next_failed_payment_whatsapp` | Processar fila falhados |
| `admin_enqueue_failed_payment_backfill` | Backfill fila falhados |
| `admin_create_member` | Criar membro manual |
| `hub_create_offer` | Criar oferta rascunho |
| `hub_save_integrations` | Guardar credenciais na BD |
| `hub_import_integrations` | Importar env → BD |

### API Comunidade (`api/comunidade/[[...slug]].js`)

| Rota | Handler | Função |
|------|---------|--------|
| `check-email` | `lib/comunidade/handlers/check-email.js` | Lookup email login |
| `set-password` | `set-password.js` | Password primeira vez |
| `request-password-reset` | `request-password-reset.js` | Pedido reset |
| `verify-reset-token` | `verify-reset-token.js` | Validar token |
| `reset-password` | `reset-password.js` | Completar reset |
| `config` | `config.js` | Supabase URL + anon key |
| `me` | `me.js` | Perfil membro |
| `products` | `products.js` | Produtos membro |
| `product` | `product.js` | Detalhe produto |
| `comments` | `comments.js` | CRUD comentários |
| `cron-ai-comments` | `cron-ai-comments.js` | Cron AI offline |
| `survey` | `survey.js` | Survey boas-vindas |
| `progress` | `progress.js` | Progresso aulas |

---

## 6. Base de dados Supabase

**62 migrations** em `supabase/migrations/`

### Comunidade (001–059) — maduro

Tabelas principais:
- `products`, `modules`, `lessons`, `members`, `member_products`
- Progresso membro, surveys, comentários
- `failed_payment_recovery_queue` (053)
- `never_logged_in_whatsapp_queue` (055)
- `purchase_email_log`, `whatsapp_message_log`
- `metrics_push_subscriptions` (056)
- Conteúdo extenso Onda Prodígio + Clube (PDFs, YouTube, drip, upsells)

### Hub (060–062) — schema pronto, runtime incompleto

| Tabela | Função |
|--------|--------|
| `hub_offers` | Ofertas (id, name, slug, status, URLs, branding, mode) |
| `hub_offer_meta_accounts` | Contas Meta por oferta |
| `hub_offer_checkouts` | Checkouts (path, stripe_price_id, amount) |
| `hub_offer_integrations` | Credenciais key/value por oferta |
| `hub_offer_domains` | Domínios funil vs hub |
| `hub_event_log` | Audit log |

**Seed:** `onda-prodigio` activa com checkouts €9 + €19, conta Meta `1078209721038923`

---

## 7. Organização lib/

| Área | Path | Papel |
|------|------|-------|
| **Hub** | `lib/hub/offers.js`, `modules.js`, `config.js`, `integration-keys.js`, `integrations-store.js`, `module-data.js`, `handlers/*` | Multi-oferta CRUD, integrações, módulos |
| **Comunidade** | `lib/comunidade/grant-access.js`, `handlers/*`, `stripe-entitlements.js`, `comment-ai.js` | Acesso, auth, AI comentários |
| **Filas** | `failed-payment-recovery-queue.js`, `never-logged-in-queue.js`, `never-logged-in-schedule.js` | Automações recovery |
| **Email** | `lib/email/*` | Gmail transaccional |
| **WhatsApp** | `lib/whatsapp/*` | Evolution API |
| **Stripe** | `lib/stripe-env.js`, `funnel-checkout-config.js`, `product-checkout-config.js`, `upsell-config.js` | Keys, checkouts, produtos |
| **Tracking** | `lib/tracking/server-events.js`, `meta-capi.js`, `ga4-mp.js`, `gtm-server.js`, `attribution.js` | CAPI, GA4 MP, Stape |
| **Métricas** | `lib/metrics/stripe-sales.js`, `stripe-failed-payments.js`, `vturb-analytics.js`, `push-notify.js` | Dashboard |
| **Meta Ads** | `lib/meta-ads/config.js`, `client.js`, `insights.js`, `merge.js` | Marketing API |
| **Admin** | `lib/admin/members.js` | Acções admin membros |
| **Supabase** | `lib/supabase-admin.js` | Client service-role |

---

## 8. O que funciona de verdade (Onda Prodígio)

### Funil & pagamentos 🟢
- VSL com VTurb
- Checkout €9 e €19 (Stripe PaymentIntents)
- Order bumps; UTM → metadata Stripe
- Webhook: grant comunidade, emails, WhatsApp, tracking server-side
- Modo test (`checkout9-test`) skip tracking/recovery

### Tracking 🟢 (single-tenant)
- **Browser:** Meta Pixel, Stape cookie extender / GTM server (`assets/tracking.js`)
- **Server:** Meta CAPI Purchase, GA4 MP, GTM server POST, VTurb conversion
- Funil events (Lead, InitiateCheckout) via `update-payment-intent.js`
- Config pública: `/api/tracking-config`

### Comunidade 🟢
- Login Supabase Auth
- Produtos, módulos, aulas, progresso drip
- Comentários + respostas Angela (manual + cron AI rule-based, GitHub Actions 5 min)
- Survey boas-vindas, teste génius, perfil
- Algumas aulas ainda com placeholder “em breve”

### Automações 🟢

| Fluxo | Canais | Trigger |
|-------|--------|---------|
| Pós-compra | Email + WhatsApp | Webhook `payment_intent.succeeded` |
| Pagamento falhado | Email + WhatsApp | Webhook `payment_intent.payment_failed` + fila |
| Nunca entrou | Email + WhatsApp | Fila após grant (horários Lisboa) |
| Resposta comentário | Email | Admin / cron AI |

WhatsApp: Evolution API (VPS, `WHATSAPP_ENABLED=true`)

### Métricas 🟢
- Stripe vendas, Meta multi-conta, VTurb, ROAS, lucros, falhados
- PWA push alertas venda (som Shopify)
- Análise campanhas Meta (`/metricas/analise`)

### Admin membros 🟢
- Listar, pesquisar, grant/revoke, criar manual, reenviar credenciais, bulk nunca entrou

### Upsells 🟡
- Páginas `/obgd/upsell1`, `/obgd/upsell2`
- Gated: `COMUNIDADE_UPSELLS_ENABLED=true` (off por defeito)

---

## 9. HUB DR Ecoom — estado actual

| Feature | Estado | Notas |
|---------|--------|-------|
| Login | 🟢 | Mesma password métricas |
| Lista ofertas | 🟢 | Entrada = grelha; não auto-abre Onda |
| Criar oferta rascunho | 🟢 | Nome + domínio funil opcional |
| Módulos por oferta | 🟡 | Cards “Activo” / “A configurar” |
| Dashboard | 🟡 | iframe `/metricas?embed=1&offer=` — **não filtra** |
| Comunidade | 🟡 | iframe `/adm?embed=1&offer=` — **global** |
| Tracking | 🟡 | Painel leitura (health, UTM, script URL) |
| Recupera | 🟡 | Stats filas + link dashboard |
| Impulsiona | 🟡 | Contagem emails; upsell sequences “Em breve” |
| Integrações | 🟡 | Form editável + import env→BD; **runtime ignora BD** |
| Funil | 🟡 | Link externo domínio oferta |

**Módulos definidos em:** `lib/hub/modules.js`  
**UI:** `hub/hub.js`, `hub/hub.css`, `hub/index.html`

---

## 10. Integrações: env vs. BD

### Na BD (hub_offer_integrations)
- 28 keys mapeadas em `lib/hub/integration-keys.js`
- Grupos: Tracking, Stripe, Gmail, WhatsApp, VTurb, Supabase
- UI hub: guardar + importar do env Vercel
- Resolução em `lib/hub/offers.js`: **BD → fallback env** (só para display no hub)

### Ainda 100% env no runtime

| Sistema | Ficheiros | Lê BD? |
|---------|-----------|--------|
| Stripe pagamentos | `lib/stripe-env.js`, `funnel-checkout-config.js` | ❌ |
| Meta CAPI | `lib/tracking/meta-capi.js` | ❌ |
| GA4 MP | `lib/tracking/ga4-mp.js` | ❌ |
| GTM/Stape client | `api/tracking-config.js`, `assets/tracking.js` | ❌ |
| Meta Ads dashboard | `lib/meta-ads/config.js` | ❌ |
| Gmail / WhatsApp | `lib/email/*`, `lib/whatsapp/*` | ❌ |
| Métricas | `lib/metrics/*` | ❌ |

**Conclusão:** Integrações na BD são **configuração armazenada**, não **configuração activa**.

---

## 11. Email, WhatsApp e automações

### Ficheiros principais

| Fluxo | Email | WhatsApp |
|-------|-------|----------|
| Pós-compra | `lib/comunidade/send-purchase-email.js` → `lib/email/purchase-email.js` | `send-purchase-whatsapp.js` |
| Falhados | `send-failed-payment-email.js` | `send-failed-payment-whatsapp.js` |
| Nunca entrou | `send-never-logged-in-email.js` | `send-never-logged-in-whatsapp.js` |
| Comentário | `lib/email/comment-reply-email.js` | — |
| Reset password | `lib/email/password-reset-email.js` | — |

### Filas (BD)
- `failed_payment_recovery_queue` — delay ~45s WhatsApp
- `never_logged_in_whatsapp_queue` — horários peak Lisboa

### Triggers admin (via sales-attribution POST)
- `admin_resend_never_logged_in`
- `admin_send_next_never_logged_in_whatsapp`
- `admin_send_next_failed_payment_whatsapp`
- `admin_enqueue_failed_payment_backfill`

### Cron
- **Comentários AI:** GitHub Actions → POST `/api/comunidade/cron-ai-comments` (5 min)
- **Filas recovery:** sem cron Vercel — depende webhook + acções manuais admin

### Em breve (hub module-data)
- Sequências upsell/cross-sell Impulsiona (`status: 'soon'`)

---

## 12. Stripe

| Local | Função |
|-------|--------|
| `api/create-payment-intent.js` | PI funil + standalone |
| `api/update-payment-intent.js` | Contacto, bumps, amount, eventos Meta |
| `api/verify-payment.js` | Página obrigado |
| `api/create-upsell-checkout.js` | Checkout Sessions upsells |
| `api/config.js` | Stripe.js client config |
| `api/stripe-webhook.js` | Handler principal (live key) |
| `lib/comunidade/grant-access.js` | Criar membro + grants |
| `lib/comunidade/stripe-entitlements.js` | Sync subscrições |
| `lib/metrics/stripe-sales.js` | Dashboard |

**Webhook events:** `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `customer.subscription.updated/deleted`

**Limitações multi-oferta:**
- Um webhook secret global
- Price IDs no env, não por oferta em runtime
- Checkouts são pastas HTML fixas

---

## 13. Tracking (Pixel, CAPI, GA4, Stape)

### Client — `assets/tracking.js`
- Fetch `/api/tracking-config`
- Meta Pixel (`fbq`)
- GTM web opcional (default off — evita duplicação Meta)
- Stape cookie extender ou GTM via `SERVER_CONTAINER_URL`
- Atribuição `localStorage` (`onda-attribution`)
- VSL: `assets/tracking-vsl.js`

### Server — `lib/tracking/server-events.js`
On `payment_intent.succeeded`:
- Meta CAPI Purchase (`meta-capi.js`) — conversão EUR→USD/BRL
- GA4 Measurement Protocol (`ga4-mp.js`)
- GTM Server POST (`gtm-server.js`)
- VTurb conversion webhook (upsells)

### Meta Ads (dashboard, separado do pixel)
- `lib/meta-ads/*` — Marketing API para `/metricas`
- Env: `META_ADS_ACCESS_TOKEN`, `META_AD_ACCOUNTS` JSON

### VTurb analytics
- `lib/metrics/vturb-analytics.js`
- Env: `VTURB_ANALYTICS_API_TOKEN`, `VTURB_PLAYER_ID`

### UTM Meta (regra projecto)
```
utm_source=facebook&utm_medium=paid&utm_content={{ad.name}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}
```

### Health / bootstrap
- `api/meta-tracking-status.js`
- `api/replay-purchase.js`
- `api/bootstrap-tracking.js`

---

## 14. Gaps para ser tipo Hotmart

### A. Runtime multi-oferta (CRÍTICO)
Nada do pipeline pagamento/tracking/métricas resolve `offer_id` por host/slug/metadata.

**Precisa:** `OfferContext` resolver — host ou slug → integrações BD + checkouts + meta accounts + product_id.

### B. Funil como produto
- Sem builder/wizard páginas
- Checkouts = pastas HTML fixas
- Nova oferta = rascunho BD sem funil gerado
- Domínio custom: manual Vercel

### C. Comunidade multi-oferta
- `hub_offers.primary_product_id` não ligado ao runtime por domínio
- Branding por oferta não aplicado

### D. Métricas multi-oferta
- `?offer=` decorativo
- Contas Meta da BD não usadas em `lib/meta-ads/config.js`

### E. Tracking configurável
- Alterar na UI hub não muda pixel/CAPI até runtime ler BD
- Sem teste CAPI/Pixel por oferta na UI

### F. Impulsiona completo
- Só welcome + email comentários
- Upsell sequences = “Em breve”

### G. UX produto
- Iframes ≠ experiência nativa
- Sem multi-user / roles
- Sem wizard criar oferta end-to-end
- README minimal (só VSL)

### H. Infra
- 12 functions — API hub colada em monólito
- Sem cron Vercel filas recovery
- WhatsApp = VPS Evolution separado
- `isHubHost()` em `lib/hub/config.js` não usado no runtime

---

## 15. Mapa de dependências

```
Integrações BD → OfferContext resolver
       ↓
Funil por oferta (host → offer → stripe keys → checkouts)
       ↓
Tracking por oferta (pixel/CAPI/GA4 da BD)
       ↓
Métricas por oferta (Meta accounts + Stripe prices da BD)
       ↓
Comunidade por oferta (product_id + branding)
       ↓
Hub deixa de ser shell → plataforma real
```

**Sem o resolver de contexto por oferta, o hub continua cosmético.**

---

## 16. Variáveis de ambiente críticas

| Grupo | Variáveis | Usado em |
|-------|-----------|----------|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_ID*`, `STRIPE_WEBHOOK_SECRET` | Pagamentos, webhook, métricas |
| Meta | `META_ACCESS_TOKEN`, `META_ADS_ACCESS_TOKEN`, `META_AD_ACCOUNTS`, `META_PIXEL_ID` | Métricas + CAPI |
| Tracking | `GA4_MEASUREMENT_ID`, `SERVER_CONTAINER_URL`, `GTM_*`, `STAPE_*` | Client + server |
| Email | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_FROM_NAME` | Transaccionais |
| WhatsApp | `EVOLUTION_*`, `WHATSAPP_ENABLED` | Automações |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Backend + client |
| VTurb | `VTURB_ANALYTICS_API_TOKEN`, `VTURB_PLAYER_ID` | VSL + métricas |
| Hub/Auth | `METRICS_DASHBOARD_PASSWORD`, `BOOTSTRAP_SECRET`, `HUB_DOMAIN` | Auth + routing |
| Upsells | `COMUNIDADE_UPSELLS_ENABLED` | Grant upsells (off default) |

Lista completa (28 keys): `lib/hub/integration-keys.js`

---

## 17. Scripts e ops

| Script / workflow | Função |
|-------------------|--------|
| `scripts/apply-supabase-migration.sh` | Aplicar migrations (Management API) |
| `scripts/whatsapp-*-campaign.sh` | Campanhas WhatsApp manuais |
| `scripts/register-stripe-domain.js` | Domínio Stripe |
| `.github/workflows/comment-ai-cron.yml` | Cron AI comentários 5 min |
| `docker-compose.whatsapp.yml` | Evolution API local/VPS |

**Regra projecto:** Se OAuth Supabase MCP falhar, usar PAT + Management API no projecto `vmyezkbkthguojmxhacw`.

---

## 18. Resumo executivo

1. **Onda Prodígio online** — funil, pagamento, comunidade, tracking, email/ZAP e métricas funcionam bem como **produto único**.

2. **HUB DR Ecoom** — schema BD + UI shell existem, mas **não controlam o runtime**; parece plataforma, comporta-se como atalhos/iframes.

3. **Para Hotmart** — falta **OfferContext** (resolver por oferta) e rebuild dos módulos em cima: funil wizard, métricas nativas, tracking editable, comunidade isolada.

---

## 19. Prompts sugeridos para próximas fases

Usar como prompts separados quando voltares da discussão:

1. **Implementar `OfferContext` resolver** — host/slug/metadata → integrações BD + fallback env  
2. **Stripe multi-oferta** — webhook + PI usa keys/prices da oferta  
3. **Métricas filtradas por oferta** — Meta accounts + Stripe da BD  
4. **Wizard criar oferta** — funil virgem + checkouts default + product Supabase  
5. **Tracking runtime BD** — tracking-config + CAPI leem `hub_offer_integrations`  
6. **Hub UI nativa** — substituir iframes por componentes partilhados  
7. **Impulsiona v1** — sequências email configuráveis por oferta  
8. **Domínios automáticos** — provisionar funil/hub na Vercel por oferta  

---

## 20. Ficheiros-chave

```
hub/index.html, hub/hub.js, hub/hub.css
lib/hub/offers.js, modules.js, config.js, integration-keys.js
lib/hub/integrations-store.js, module-data.js, handlers/*
api/sales-attribution.js, api/stripe-webhook.js
api/comunidade/[[...slug]].js
lib/comunidade/grant-access.js, failed-payment-recovery-queue.js
lib/tracking/server-events.js, meta-capi.js, ga4-mp.js
lib/metrics/stripe-sales.js, lib/meta-ads/config.js
assets/tracking.js, assets/tracking-vsl.js
funnel/index.html
metricas/index.html, metricas/metricas.js
adm/index.html, adm/adm.js
comunidade/produto.js, comunidade/auth.js
supabase/migrations/060_hub_offers.sql
supabase/migrations/061_hub_offer_domains.sql
supabase/migrations/062_hub_domain_vercel.sql
vercel.json
.env.example
```

### URLs produção

| URL | Uso |
|-----|-----|
| https://hub-dr-ecoom.vercel.app/ | HUB (lista ofertas) |
| https://onda-prodigio.vercel.app/ | Funil Onda Prodígio |
| https://onda-prodigio.vercel.app/comunidade/ | Comunidade |
| https://onda-prodigio.vercel.app/metricas/ | Dashboard (directo) |
| https://onda-prodigio.vercel.app/adm/ | Admin membros (directo) |

---

*Documento gerado para discussão estratégica. Actualizar quando fases forem implementadas.*
