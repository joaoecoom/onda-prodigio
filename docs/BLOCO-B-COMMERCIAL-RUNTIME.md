# Bloco B — Commercial Runtime (implementado)

**Data:** 21 Agosto 2026  
**Migration:** `071_hub_orders_and_checkout.sql` — **APPLIED** em produção  
**Testes:** `npm test` → **161/161**

## Objetivo

Fechar o circuito:

```text
Oferta → Page Engine (CTA) → Checkout universal → Stripe → Webhook → Order → Member → Comunidade
```

## Implementado

### Database (`071`)
- `hub_orders` — idempotência por `stripe_payment_intent_id`
- `hub_offer_checkouts` — `product_id`, `currency`, `success_path`, `cancel_path`, `is_active`

### Checkout universal
- **`/checkout/?offer={slug}&product_id={id}`** — `checkout/index.html`, `checkout/checkout.js`
- Reutiliza CSS do checkout9
- **`lib/hub/checkout-resolver.js`** — resolve amount/product/price por oferta
- **`funnel-checkout-config.js`** — checkout id `main`
- **`api/config.js`** — config pública por oferta (`?checkout=main&offer=`)
- **`api/create-payment-intent.js`** — path universal com `checkout_type: offer`, metadata completa
- Provisioning: checkout `main` com €1.00 (100 cents) default para novas ofertas

### Stripe
- **`lib/hub/stripe-client.js`** — `pickOfferCheckout` suporta `main`
- Backend autoridade do preço (valida produto ↔ oferta)

### Webhook + access
- **`lib/hub/orders.js`** — grava order antes do grant
- **`lib/comunidade/grant-access.js`**:
  - `parseProductIdsFromMetadata` — usa `product_id` explícito
  - `shouldGrantAccessForPayment` — **checkout universal funciona em test mode**
  - Legacy Onda: `checkout9-test` continua sem grant

### Page Engine → Checkout
- **`block-registry.js`** — botões com `action: checkout` geram URL `/checkout/?offer=...`
- **`page-renderer.js`** — passa `offer`, `funnel`, `page` no contexto dos blocos

### Routing
- **`vercel.json`** — rewrite `/checkout` → `/checkout/index.html`

## Onda Prodígio

**Intacta:** `funnel/`, `checkout9/`, `checkout19/` — sem remoção.

Migração Onda → Page Engine publicada: **pendente validação manual** (seed draft existe).

## Teste integrado

### Automatizado (unit)
- `tests/commercial-runtime.test.js` — metadata, grant test mode, checkout resolver

### Manual (Stripe test mode)

1. HUB → criar **Oferta Teste B**
2. Configurar integrações Stripe **test** na oferta (ou usar env fallback se mesma conta)
3. Funil → criar funnel + sales page com botão `action: checkout`
4. Publicar página → `/p/{offer}/{funnel}/{page}`
5. CTA → `/checkout/?offer=...&product_id=...&mode=test`
6. Cartão `4242 4242 4242 4242`
7. Webhook → verificar logs `Hub order` + `Comunidade access`
8. Login comunidade → produto desbloqueado (`produto-generic.js`)

**Nota:** Pagamento real não executado nesta sessão — requer deploy + Stripe test keys configuradas na oferta.

## Pendências (Bloco C)

- Tracking purchase events por oferta no fluxo universal (parcial — legacy skip test)
- Dashboard contabilizar `hub_orders`
- Publicar Onda Page Engine + redirect legacy
- Playwright E2E

## Ficheiros principais

| Ficheiro | Alteração |
|----------|-----------|
| `supabase/migrations/071_hub_orders_and_checkout.sql` | Orders + checkout cols |
| `lib/hub/orders.js` | Novo |
| `lib/hub/checkout-resolver.js` | Novo |
| `lib/hub/offer-provisioning.js` | Checkout main €1 |
| `lib/hub/stripe-client.js` | main checkout |
| `lib/funnel-checkout-config.js` | Universal checkout id |
| `lib/comunidade/grant-access.js` | Universal grant + product_id |
| `api/create-payment-intent.js` | Universal path |
| `api/config.js` | Offer checkout config |
| `api/stripe-webhook.js` | Persist orders |
| `checkout/index.html`, `checkout/checkout.js` | Novo |
| `lib/hub/page-renderer/block-registry.js` | CTA checkout |
| `tests/commercial-runtime.test.js` | Novo |
