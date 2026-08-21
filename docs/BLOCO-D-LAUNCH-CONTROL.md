# Bloco D — Launch Control + Health Check (implementado)

**Data:** 21 Agosto 2026  
**Migration:** `072_hub_domain_status.sql` — **APPLIED** em produção  
**Testes:** `npm test` → **179/179**

## Objetivo

Transformar o HUB num **Launch Control** que responde objectivamente:

> "Esta oferta está pronta para lançar?"

Sem reescrever Blocos A/B/C.

---

## Implementado

### Core

| Ficheiro | Função |
|----------|--------|
| `lib/hub/launch-readiness.js` | Motor de checks + readiness (`ready` / `almost_ready` / `not_ready`) |
| `lib/hub/handlers/launch-health.js` | API `hub_launch_health` + `verify_domain` |
| `lib/hub/vercel-domains.js` | Integração Vercel (domínio no projecto existente) |
| `supabase/migrations/072_hub_domain_status.sql` | `status`, `dns_records`, `last_checked_at` em `hub_offer_domains` |

### API

```text
GET  /api/sales-attribution?action=hub_launch_health&slug={offer}
GET  ...&refresh=1&sync_domain=1
POST ...&launch_action=verify_domain  { domain?, save? }
```

### UI HUB

- Painel **Launch Status** na home da oferta (`hub/hub.js`, `hub/hub-v2.css`)
- Resumo 🟢/🟡/🔴 + issues com botões **Corrigir** → módulos existentes
- Detalhe expandível de todos os checks por grupo

### AI Agent

- Tool `get_offer_launch_status` (`registry.js`, `executor.js`)

### Testes

- `tests/launch-readiness.test.js` — checks unitários + isolamento + Vercel mapping

---

## Health Checks (lista)

| ID | Grupo | Severidade |
|----|-------|------------|
| offer | Setup | critical |
| product | Setup | critical |
| checkout | Setup | critical |
| funnel | Funil | critical |
| sales_page | Funil | critical |
| cta_checkout | Funil | critical |
| stripe | Stripe | critical |
| stripe_webhook | Stripe | critical |
| tracking_meta_* / ga4 | Tracking | important |
| purchase_tracking | Tracking | important |
| community_access | Comunidade | critical |
| community_content | Comunidade | optional |
| domain | Domínio | important |
| domain_routing | Domínio | important |
| commercial_smoke | Comercial | critical |
| test_order | Comercial | optional |

### Readiness

- **NOT READY** — qualquer falha `critical`
- **ALMOST READY** — critical OK, avisos/falhas `important`
- **READY TO LAUNCH** — critical OK, sem bloqueios importantes

Opcionais (conteúdo vazio, order de teste) **não bloqueiam**.

---

## Domínios / Vercel

Modelo **multi-oferta, um runtime Vercel**:

```text
dominio-a.com → Vercel project → offer_id A
dominio-b.com → Vercel project → offer_id B
```

Estados: `not_configured`, `pending`, `dns_required`, `verifying`, `active`, `error`

Env vars (runtime):

```text
VERCEL_TOKEN
VERCEL_PROJECT_ID
VERCEL_TEAM_ID (opcional)
```

Sem token → aviso honesto: *validação funcional pendente* (não marca PASS falso).

---

## AI Agent

Validado: `get_offer_launch_status` executa `evaluateLaunchReadiness` scoped por `offer_id`.

Worker/monitoring: sem alterações — documentado como pendência operacional VPS.

---

## Validação produção

**Não executada nesta sessão.** Após deploy:

1. Abrir oferta no HUB → ver Launch Status
2. `GET hub_launch_health&slug=...`
3. Configurar domínio → `POST verify_domain`
4. Confirmar isolamento Oferta A vs B

---

## Pendências reais

- Playwright E2E launch flow
- Webhook refund → readiness comercial
- Worker health dashboard VPS
- Publicar Onda Page Engine + redirects
