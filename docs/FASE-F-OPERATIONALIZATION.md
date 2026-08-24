# FASE F — Operationalization + One-Click Offer Launch

## Objetivo

Transformar o runtime comercial validado (Blocos A–E) num sistema operacional onde **nova oferta = nova configuração**, não um novo projecto.

## Implementado

### Offer Setup Wizard (HUB UI)

- Botão **Assistente de setup** na lista de ofertas (`hub/hub.js`)
- Modal de 9 passos que orquestra módulos existentes (não substitui funil, integrações, comunidade, etc.)
- Passos: Oferta → Produto → Stripe → Funil → Tracking → Comunidade → Domínio → Check → Ready to Launch
- Cada passo com botão **Configurar** que abre o módulo HUB correspondente via `openModule()`

### Provisioning idempotente

- `provisionOffer(slug)` em `lib/hub/offer-provisioning.js`
- Garante: `products`, `primary_product_id`, `hub_offer_checkouts` main
- `updateMainCheckout()` para preço/moeda no wizard (passo 2)

### API operacional

| Acção | Método | Handler |
|-------|--------|---------|
| `hub_offer_wizard` | GET | Estado do wizard por oferta |
| `hub_provision_offer` | POST | Re-provision + preço checkout |
| `hub_validate_offer` | POST | Validação completa (launch readiness) |
| `hub_launch_offer` | POST | Launch gated (só se `ready`) |

### Launch checklist executável

- Painel Launch Status com **Validar oferta** e **Launch offer**
- Checks individuais com botão **Corrigir** quando `check.action` existe
- Issues com botões que abrem módulos existentes (sem UI duplicada)

### Stripe connectivity

- Status: `CONNECTED` / `TEST MODE` / `LIVE MODE` / `NOT CONFIGURED` / `ERROR`
- Nunca expõe secret keys (usa flags `configured` de `integrations-store`)

### AI Agent tools

Novas tools (mesmo runtime que HUB):

- `provision_offer`
- `validate_offer`
- `launch_offer`

Existente: `get_offer_launch_status`, `create_funnel`, `create_page`, etc.

### Cursor compatibility

UI e Cursor/Agent usam o mesmo runtime:

- Funnel Engine API (`hub_funnel_create`, `hub_page_create`, …)
- Agent tools com `offer_id` guard
- HUB reconhece recursos criados fora da UI automaticamente (por `offer_id`)

## Limitações documentadas

### Domínios Vercel

Requer `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` no ambiente. Sem estes valores, o wizard mostra configuração necessária — **não inventa PASS**.

### Meta CAPI / GA4 live validation

O webhook Stripe dispara eventos via `lib/tracking/server-events.js` usando integrações por oferta. Validação endpoint-a-endpoint (Meta Events Manager / GA4 DebugView) requer:

- Credenciais live da oferta
- Pagamento real ou teste com webhook recebido
- Acesso externo às consolas Meta/Google

**Limitação:** sem credenciais de consola externa no CI, validamos a cadeia interna (webhook → order → tracking dispatch) via testes unitários e E2E Stripe CLI, não confirmação visual nas consolas.

### Worker VPS

Código `recover_stale_ai_tasks` existe em `scripts/hub-agent/worker/poll-tasks.js`. Validação manual no Contabo pendente — não reescrito nesta fase.

### Onda Prodígio legacy

`funnel/`, `checkout9/`, `checkout19/` permanecem intactos. Migração Onda → Page Engine é auditoria/publicação futura — sem redirects até nova versão comprovada.

## Segurança (reutilizado)

- Auth HUB via `metricsAuth.isAuthorized`
- Agent tools: `offer_id` bound guard
- Stripe secrets server-side only
- Launch bloqueado com checks críticos FAIL

## Testes

```bash
npm test
npm run test:e2e
```

Novo: `tests/offer-setup-wizard.test.js`

## Fluxo alvo

```
NOVA OFERTA → Wizard → PROVISION → módulos existentes → VALIDATE → LAUNCH → DASHBOARD
```

Mesmo fluxo disponível via Cursor/AI Agent com tools `provision_offer`, `validate_offer`, `launch_offer`.
