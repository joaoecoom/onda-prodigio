# Fase 5E — Tracking runtime por oferta

Pixel, GA4 e Meta CAPI passam a resolver credenciais por oferta via `hub_offer_integrations`, com fallback env global (Onda Prodígio).

## Scope

- **`lib/tracking/offer-tracking.js`** — resolve client + server tracking por oferta
- **`/api/tracking-config`** — usa offer-tracking (slug, domain ou default)
- **Meta CAPI + GA4 MP** — aceitam `tracking` override por evento
- **Stripe webhook / server-events** — resolve oferta via `metadata.offer_id` ou `metadata.offer_slug`
- **Page Engine (production)** — injecta `tracking.js` + `data-offer-slug`
- **`ga4_api_secret`** — chave editável no módulo Integrações

**Fora de scope:** GTM server POST por oferta, VTurb multi-oferta, bootstrap-tracking automático.

## Resolução server-side (CAPI)

```
PaymentIntent.metadata.offer_slug | offer_id
  → offerContext + getOfferIntegrations(includeSecrets)
  → meta-capi / ga4-mp com pixel + tokens da oferta
  → fallback: default offer + env
```

## Resolução client-side

```
/api/tracking-config?offer=slug
  ou Host header (domínio funil)
  → pixel / GA4 / GTM / Stape da oferta
```

Pages publicadas do Page Engine incluem:

```html
<script defer src="/assets/tracking.js"></script>
<script>document.documentElement.setAttribute("data-offer-slug","…");</script>
```

## Metadata Stripe (recomendado)

Incluir no checkout (via `getStripeTrackingMetadata`):

- `offer_id`
- `offer_slug`

Permite CAPI correcto mesmo com webhook global.

## Ficheiros

- `lib/tracking/offer-tracking.js`
- `lib/tracking/meta-capi.js`, `ga4-mp.js`, `server-events.js`
- `lib/hub/integration-keys.js`
- `api/tracking-config.js`
- `assets/tracking.js`
- `lib/hub/page-renderer/page-renderer.js`
- `tests/tracking-offer-runtime.test.js`

## Testes

```bash
npm test
```
