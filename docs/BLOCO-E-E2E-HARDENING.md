# Bloco E — E2E + Production Hardening

**Data:** 21 Agosto 2026  
**Unit tests:** `npm test` → **185/185**  
**Playwright:** `npm run test:e2e` (requer env — ver abaixo)

## Implementado

### Refunds (Bloco E §17-18)

| Ficheiro | Alteração |
|----------|-----------|
| `lib/hub/orders.js` | `markOrderRefundedFromCharge()` — idempotente |
| `api/stripe-webhook.js` | `charge.refunded` + dedupe eventos |
| `lib/hub/stripe-events.js` | `claimStripeEvent()` — `hub_stripe_events` |
| `supabase/migrations/073_stripe_events_and_worker_recovery.sql` | Tabela + `recover_stale_ai_tasks()` |

Métricas: `gross_revenue_eur`, `refunds_eur`, `net_revenue_eur` (já em `order-metrics.js`).

### Worker hardening (Bloco E §22)

| Ficheiro | Alteração |
|----------|-----------|
| `scripts/hub-agent/worker/poll-tasks.js` | `recoverStaleTasks()` antes de cada poll |
| Migration 073 | RPC `recover_stale_ai_tasks(p_timeout_minutes)` — default 45m |

Env: `AI_TASK_STALE_MINUTES=45`

### Playwright E2E (Bloco E §2-16)

| Ficheiro | Conteúdo |
|----------|----------|
| `playwright.config.js` | Config Chromium |
| `e2e/commercial-flow.spec.js` | Hub, launch health, metrics, checkout, preview Onda, create offer, attribution |

### Testes unitários Bloco E

| Ficheiro | Conteúdo |
|----------|----------|
| `tests/bloco-e-hardening.test.js` | Refunds, net revenue, isolation, domain routing, agent tool |

---

## Como correr Playwright

```bash
export E2E_BASE_URL=https://hub-dr-ecoom.vercel.app
export E2E_HUB_TOKEN=<METRICS_DASHBOARD_PASSWORD>
export E2E_SITE_URL=https://onda-prodigio.vercel.app  # opcional
export E2E_OFFER_SLUG=e2e-xxxx                        # opcional

npm run test:e2e
```

Sem env → testes browser **skipped** (comportamento intencional).

---

## Validação por camada

| Camada | Estado nesta sessão |
|--------|---------------------|
| **AUTOMATED (unit)** | ✅ 185/185 |
| **AUTOMATED (Playwright)** | ⚠️ Skipped sem `E2E_BASE_URL` + token |
| **PRODUCTION smoke** | ❌ Não executado — requer deploy + Stripe test manual |

---

## Onda Page Engine (§19-21)

- Preview testado via Playwright: `/preview/onda-prodigio/onda-principal/vsl-sales?preview=1`
- **Publicação live + redirects `/funnel/`** — **NÃO feitos** (aguarda validação manual pós-deploy)
- Legacy `funnel/`, `checkout9/`, `checkout19/` — **intactos**

---

## AI Agent / Launch Status (§23)

- `get_offer_launch_status` usa `evaluateLaunchReadiness()` — mesma fonte que HUB Launch Status
- Worker recovery para tasks `running` stale

---

## Fluxos E2E cobertos (Playwright)

1. Hub shell load  
2. Launch health API  
3. Metrics API (ROAS null sem spend)  
4. Checkout page render  
5. Onda Page Engine preview  
6. Create offer + provisioning check  
7. UTM/fbclid capture no checkout  

### Não automatizado (requer Stripe + webhook live)

- Pagamento 4242 completo  
- Verificação `hub_orders` pós-webhook  
- Login comunidade membro  
- Dashboard pós-compra  

Documentar como **manual pós-deploy**.

---

## Problemas restantes (reais)

1. E2E pagamento Stripe completo — requer webhook endpoint público + keys test na oferta  
2. Publicar Onda vsl-sales + redirects legacy  
3. Playwright multi-offer isolation com 2 orders reais  
4. VPS worker — validar `recover_stale_ai_tasks` em produção
