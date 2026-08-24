# Bloco C — Tracking + Attribution + Dashboard (implementado)

**Data:** 21 Agosto 2026  
**Testes:** `npm test` → ver secção Testes abaixo

## Objetivo

Fechar o circuito:

```text
Sales Page → CTA → Checkout → Stripe → hub_orders → purchase tracking → Dashboard
```

Reutilizando `lib/tracking/`, `assets/tracking.js`, Meta CAPI, GA4 MP e `hub-metrics` — **sem sistema paralelo**.

---

## Implementado

### Tracking comercial

| Ficheiro | Alteração |
|----------|-----------|
| `lib/tracking/commerce-events.js` | **Novo** — regras purchase/universal vs legacy test |
| `lib/tracking/constants.js` | `buildTrackingItemsFromPayment()` para checkout universal |
| `lib/tracking/server-events.js` | Purchase CAPI/GA4 com produto da oferta |
| `api/stripe-webhook.js` | Purchase tracking para checkout universal (incl. test mode) |
| `assets/tracking.js` | Alias `collectPayload` → `getStripeTrackingMetadata` |
| `checkout/checkout.js` | `checkout_started`, `initiate_checkout`, `payment_submitted` + UTM no PI |

### Attribution → Order

- UTM/fbclid/campaign já fluem via `buildStripeTrackingMetadata()` → metadata Stripe → `hub_orders.metadata`
- `lib/hub/order-metrics.js` — extrai atribuição das orders para dashboard

### Dashboard (`hub_orders` como fonte financeira)

| Ficheiro | Alteração |
|----------|-----------|
| `lib/hub/order-metrics.js` | **Novo** — fetch, group by offer, AOV, merge com Stripe legacy |
| `lib/hub/hub-metrics.js` | Overview + per-offer usam `hub_orders` + Stripe (dedupe por PI) |
| `lib/hub/meta-metrics.js` | `computeCpa()` |
| `lib/metrics/sales-report.js` | Export `normalizeSaleAttribution` |
| `hub/hub.js` | Strip métricas: Receita, Vendas, **AOV**, Gasto Meta, ROAS, **CPA** |

### Métricas por oferta

- **Revenue** — `hub_orders` (paid) + Stripe legacy (Onda)
- **Orders** — contagem orders paid
- **AOV** — revenue / orders (ou `—`)
- **Ad Spend** — Meta multi-account existente
- **ROAS** — revenue / spend (ou `—`, nunca 0 falso)
- **CPA** — spend / orders (ou `—`)
- **Isolamento** — group by `offer_id`

---

## Fluxo purchase (fonte de verdade)

```text
payment_intent.succeeded (webhook)
  → hub_orders.upsert (idempotente)
  → grant-access (universal)
  → sendPurchaseFromPaymentIntent (CAPI + GA4) se commerce-events permitir
  → dashboard lê hub_orders
```

Thank-you page **não** confirma venda.

---

## Onda Prodígio

Checkout legacy intacto. Dashboard Onda continua via Stripe API global + `hub_orders` vazio para vendas legacy.

---

## Testes

```bash
npm test
```

Novos: `tests/commercial-tracking.test.js`

---

## Validação manual (após deploy)

1. Oferta Teste B → checkout test → webhook
2. Verificar `hub_orders` na BD
3. HUB → métricas da oferta → receita/vendas/AOV
4. Confirmar isolamento entre ofertas

**Não executado nesta sessão** — requer deploy + pagamento Stripe test.

---

## Pendências → Bloco D/E

- Refunds Stripe → `hub_orders.status=refunded` (webhook `charge.refunded` ainda não ligado)
- Funnel metrics (visitors → VSL → CTA) agregados no dashboard
- Launch Checklist / Health Check / Playwright E2E
- Publicar Onda Page Engine + redirects
