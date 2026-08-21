# FASE G — Final Operational Automation

## G1 — Custom Domains

### Routing dinâmico
- `vercel.json`: rewrite global `/:funnel/:page` → `hub_page_domain` (sem `has.host` por oferta)
- Fluxo: Host → `domain-routing.resolveFunnelOfferFromHost` → `offer-context.resolveOfferByDomain` → `hub_offer_domains` → Page Engine
- Legacy Onda intacto: rotas reservadas (`checkout9`, `comunidade`, etc.) bloqueadas em `isReservedDomainPath`
- Hub host rejeitado — não resolve oferta funil

### Vercel
- Reutiliza `lib/hub/vercel-domains.js` (1 project, N domains)
- Sem novo project por oferta
- Sem editar `vercel.json` por domínio novo

### Estados
- Compatíveis: `not_configured`, `dns_required`, `verifying`, `active`, `error`
- Sem `VERCEL_TOKEN`: mensagem **VERCEL AUTOMATION NOT CONFIGURED** (launch-readiness)

### Testes
- `tests/domain-routing-isolation.test.js` — domain A/B isolation, unknown domain, hub host

### Production DNS
- **PENDING** — validação DNS real depende de domínio externo + propagação

---

## G2 — AI Offer Provisioning

### Novas tools (34 total)
| Tool | Função |
|------|--------|
| `create_offer` | Idempotente por slug via `offers.findOrCreateOffer` |
| `save_offer_integrations` | Reutiliza `integrations-store.saveOfferIntegrations` |
| `get_offer_integrations_status` | Flags only — sem secrets |
| `apply_template` | Reutiliza `seed-template.seedPageFromTemplate` |
| `publish_page` | Alias `updatePage(status: published)` |

### Agent flow suportado
```
create_offer → provision (price) → create_funnel → create_page → apply_template
→ blocks → publish_page → validate_offer → launch_offer (se READY)
```

### Segurança
- Secrets redacted em logs (`logger.sanitizeInput`)
- Integration status: `Stripe configured` / `STRIPE NOT CONFIGURED` — nunca imprime keys
- `create_offer` não inventa credenciais — indica `next_steps`

### Testes
- `tests/agent-tools-phase-g.test.js`
- `tests/offers-find-or-create.test.js`

---

## G3 — Community Agent

### Tools (reutilizam `lib/comunidade/content-admin.js`)
| Tool | Função |
|------|--------|
| `get_content_tree` | Product → Modules → Lessons |
| `create_content_module` | Módulo top-level |
| `create_content_lesson` | Aula num módulo |
| `update_content_module` | Actualizar módulo |
| `update_content_lesson` | Actualizar aula |

### Isolamento
- `productsService.assertProductBelongsToOffer` em todas as operações
- Cross-offer rejeitado com `CROSS_OFFER_ACCESS`

---

## Tests

```
npm test → 208/208
npm run test:e2e → 8/8
```

---

## Remaining gaps (externos)

| Gap | Tipo |
|-----|------|
| DNS manual do cliente | CRITICAL (externo) |
| Stripe/Meta/GA4 credentials | CRITICAL (externo, por design) |
| VERCEL_TOKEN para automação API | IMPORTANT |
| VPS workspace por slug (Hub AI worker) | IMPORTANT |
| Validação DNS production end-to-end | PENDING |
