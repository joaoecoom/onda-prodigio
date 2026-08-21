# Fase 5D — Custom Domains (URLs públicas por oferta)

Servir pages publicadas no **domínio funil** da oferta com URLs curtas e links Live correctos no HUB/editor.

## Scope

- **`buildPageUrls(slugs, offer)`** — paths hub + URLs absolutas no domínio funil
- Rota curta **`https://{funnel_domain}/{funnel}/{page}`** (só published)
- Rota hub **`/p/:offer/:funnel/:page`** continua a funcionar
- **`hub_page_domain`** — resolve oferta pelo `Host`, renderiza page
- **`hub_page_list` / `hub_page_tree`** — incluem `page_urls`, `public_url` (live preferido)
- Rewrite Vercel para `onda-prodigio.vercel.app` (domínios adicionais: mesmo padrão)

**Fora de scope:** provisionamento automático Vercel DNS, wildcard multi-tenant, SSL automation.

## URLs

| Contexto | Exemplo |
|----------|---------|
| Hub path | `/p/ai-test-offer/sales-funnel/sales-page` |
| Domínio funil (preferido Live) | `https://onda-prodigio.vercel.app/sales-funnel/sales-page` |
| Preview | `/preview/...?preview=1` |

## Resolução domínio

```
Host → offerContext.resolveOfferByDomain
  → rejeita hub_domain / hosts HUB
  → renderPageHtml(offer.slug, funnel, page)
```

Rotas reservadas (`/comunidade/*`, `/checkout9`, `/preview`, …) **não** entram no handler domain.

## API pública

| Acção | Método |
|-------|--------|
| `hub_page_domain` | GET `?funnel=&page=` (+ Host header) |

## Ficheiros

- `lib/hub/page-builder/urls.js`
- `lib/hub/page-builder/domain-routing.js`
- `lib/hub/handlers/page-domain.js`
- `lib/hub/handlers/page-builder.js`
- `api/sales-attribution.js`
- `vercel.json`
- `hub/hub.js`
- `tests/page-builder-domains.test.js`
- `tests/page-builder-publish.test.js`

## Novo domínio funil

1. Registar em `hub_offer_domains` (`domain_type = funnel`) + `hub_offers.funnel_domain`
2. Associar domínio ao projecto Vercel
3. Acrescentar rewrite `/:funnel/:page` com `has.host` (ou middleware futuro)

## Testes

```bash
npm test
```
