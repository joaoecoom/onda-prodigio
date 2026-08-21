# Fase 6B — Stripe multi-oferta

Checkout e PaymentIntent passam a resolver **chaves, preços e metadata por oferta** via HUB (`hub_offer_integrations` + `hub_offer_checkouts`), com fallback para variáveis de ambiente (comportamento legacy Onda Prodígio).

## O que mudou

| Componente | Antes | Depois |
|------------|-------|--------|
| `/api/config` | Chaves/preço globais (`STRIPE_*`) | Resolve oferta (slug, query, host) → integrações + checkout row |
| `/api/create-payment-intent` | Global | Mesmo resolver; metadata inclui `offer_id` / `offer_slug` |
| `/api/update-payment-intent` | Global | Mesmo resolver (conta Stripe alinhada com a oferta) |
| `/api/stripe-webhook` | Um `STRIPE_WEBHOOK_SECRET` | Global primeiro; fallback `?offer=slug` ou secrets distintos por oferta |

## Resolução de oferta

Ordem em `lib/hub/stripe-client.js`:

1. `offer_id` / `offer_slug` no body ou query
2. `tracking.offer_id` / `tracking.offer_slug` (checkout com `assets/tracking.js`)
3. Host (`x-forwarded-host` / `host`) → domínio funil
4. Oferta activa por defeito (`onda-prodigio`) se `allowDefault: true`

## Checkouts por oferta

Cada linha em `hub_offer_checkouts`:

- `checkout_id` — ex. `checkout9`, `checkout19`
- `amount_cents` — valor do PI
- `stripe_price_id` / `stripe_test_price_id` — price ID Stripe
- `path` / `test_path` — URLs públicas

Se a oferta não tiver linha para o checkout pedido, usa-se `lib/funnel-checkout-config.js` (env).

## Integrações Stripe (por oferta)

Chaves em `hub_offer_integrations` (grupo Stripe no HUB):

- `stripe_secret_key` / `stripe_publishable_key`
- `stripe_test_secret_key` / `stripe_test_publishable_key`
- `stripe_webhook_secret`

Valores em falta na BD caem para env (`STRIPE_*`).

## Webhook multi-conta (opcional)

Mesma conta Stripe (fase mínima): um endpoint, secret global — sem alteração no Dashboard.

Contas separadas por oferta:

1. URL por oferta: `https://…/api/stripe-webhook?offer=minha-oferta`
2. Ou secrets distintos registados na BD — o handler tenta verificar com cada um

Tracking CAPI (Fase 5E) já usa `metadata.offer_slug` no webhook — não precisa de alteração.

## Testes

```bash
npm test -- tests/stripe-multi-offer.test.js
```

## Próximos passos (fora desta fase)

- Métricas Stripe filtradas por oferta (`lib/metrics/stripe-sales.js`)
- Upsell checkout sessions por oferta
- Comunidade / grant-access com `offer_id`
- Wizard HUB para configurar checkouts + Stripe por oferta
