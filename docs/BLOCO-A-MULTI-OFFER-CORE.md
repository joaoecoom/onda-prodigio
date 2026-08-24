# Bloco A — Multi-Offer Core (concluído)

**Data:** 21 Agosto 2026  
**Migration:** `070_products_offer_id.sql` — **APPLIED** em `vmyezkbkthguojmxhacw`  
**Testes:** `npm test` → **156/156**

## Entregue

### A1 — Modelo de dados
- `products.offer_id` → FK `hub_offers(id)`
- Backfill: produtos via `primary_product_id`; restantes → `onda-prodigio`

### A2 — Produtos por oferta
- `lib/comunidade/products-service.js` — validação `assertProductBelongsToOffer`
- `GET /api/comunidade/products?offer=` — filtra por oferta
- `GET /api/comunidade/product?id=` — valida pertença à oferta
- `GET /api/comunidade/me?offer=` — `product_ids` scoped
- `auth-helpers.getAccessibleProductIds` — filtro admin e membro por `offerId`

### A3 — Comunidade genérica
- `comunidade/produto-generic.js` — renderer data-driven (módulos/aulas/player/progresso/editor)
- `lib/comunidade/legacy-products.js` — lista explícita de produtos legacy
- `produto.js` delega para generic quando produto **não** está na lista legacy
- Onda / Clube / order bumps mantêm `produto.js` legacy intacto

### A4 — Criação automática de oferta
- `lib/hub/offer-provisioning.js` — cria produto + `primary_product_id` + checkout placeholder
- `offers.createOffer()` chama provisioning após insert
- API existente: `POST` create-offer handler

### A5 — Isolamento
- APIs comunidade filtram/validam por `offer_id`
- content-admin valida produto ↔ oferta

### A6 — Handoff gestor
- `hub-enter.js` — `sessionStorage` `comunidade-gestor` + `comunidade-offer` após handoff
- signOut antes de setSession (já existia)

## Ficheiros principais

| Ficheiro | Alteração |
|----------|-----------|
| `supabase/migrations/070_products_offer_id.sql` | Nova coluna + backfill |
| `lib/hub/offer-provisioning.js` | Novo |
| `lib/comunidade/offer-resolver.js` | Novo |
| `lib/comunidade/products-service.js` | Novo |
| `lib/comunidade/legacy-products.js` | Novo |
| `lib/comunidade/handlers/products.js` | Filtro oferta |
| `lib/comunidade/handlers/product.js` | Validação oferta |
| `lib/comunidade/handlers/me.js` | Scope oferta |
| `lib/comunidade/auth-helpers.js` | Scope oferta |
| `lib/comunidade/content-admin.js` | Validação produto |
| `lib/hub/offers.js` | Provisioning no create |
| `comunidade/produto-generic.js` | Novo renderer |
| `comunidade/produto.js` | Delegação generic |
| `comunidade/hub-enter.js` | Gestor session flags |
| `comunidade/index.js` | Products API com offer |
| `tests/multi-offer-core.test.js` | Novo |

## Critério DONE (Bloco A)

Criar oferta **Oferta Teste** no HUB → gera:
- registo `hub_offers`
- produto `oferta-teste` com `offer_id`
- checkout placeholder em `hub_offer_checkouts`
- comunidade vazia editável via Modo edição + produto-generic

## Próximo: Bloco B — Commercial Runtime

- Checkout universal `/checkout/?offer=`
- Publicar Onda Page Engine + redirects legacy
- Webhook/order/access end-to-end por oferta
