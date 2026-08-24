# HUB AI-Native Architecture

> Estado: Agosto 2026 · Runtime A–H validado · Reorganização UX + AI Operations em curso

## Current State

### Runtime (NÃO alterar)

| Sistema | Estado | Paths |
|---------|--------|-------|
| Stripe + webhook + orders | ✅ Produção | `api/stripe-webhook.js`, `lib/hub/orders.js` |
| Member access | ✅ | `member_products`, grant-access |
| Tracking | ✅ | `lib/tracking/`, `assets/tracking.js` |
| Page Engine | ✅ | `lib/hub/funnel-engine/`, `lib/hub/page-renderer/` |
| Quiz Engine | ✅ | `lib/hub/quiz-engine/` |
| Community | ✅ | `lib/comunidade/` |
| Launch readiness | ✅ | `lib/hub/launch-readiness.js` |
| Domains / Vercel | ✅ | `lib/hub/vercel-domains.js` |
| Agent tools (49) | ✅ | `lib/hub/agent-tools/` |
| Onda legacy | ✅ Intacta | `checkout9/`, `checkout19/`, env fallback |

### AI Layer (implementado)

| Componente | Path | Função |
|------------|------|--------|
| AI Provider | `lib/llm/index.js` | Abstracção Gemini |
| Orchestrator | `lib/hub/ai-orchestrator.js` | Context → tools → steps |
| Context Engine | `lib/hub/ai-context-engine.js` | Contexto por módulo |
| Tool Bridge | `lib/hub/gemini-tool-bridge.js` | Modos → subset de tools |
| Page AI | `lib/hub/page-builder/gemini-page-assistant.js` | Vertical slice pages |
| AI Panel | `hub/hub-ai-panel.js` | UI reutilizável |
| Pages Studio | `hub/hub-pages-studio.js` | Preview + AI |
| Legacy chat | `hub/hub-gemini.js` | Módulos antigos |

### Offer Isolation

- `integration-resolver.js`: só `onda-prodigio` herda env
- Novas ofertas: `settings.integrations_isolated: true`
- Testes: `tests/integration-isolation.test.js`

### New Offer Provisioning (atual)

**Cria automaticamente (infraestrutura):**
- `hub_offers` row (draft, test mode)
- `products` row (vazio)
- `hub_offer_checkouts` row (`main`, preço configurável)
- `hub_offer_domains` (hub + funnel se indicado)
- `meta_reporting_currency` (moeda comercial escolhida — não é tracking copiado)

**NÃO cria:**
- Funnels / pages / sections / blocks
- Integrações (pixel, Stripe keys, GTM…)
- Community content
- Checkout templates Gemini
- Stripe Price IDs

## Target State

```
OFERTA
├── Funis        → Visual builder + Gemini
├── Páginas      → Pages Studio + Page Engine AI
├── Checkouts    → Multi-checkout + Gemini
├── Quiz         → Quiz builder + Gemini
├── Comunidade   → Structure templates + Gemini
├── Tracking     → Empty + Gemini configure
├── Recuperação  → Workflow builder + Gemini
├── Automações   → Sequences + Gemini
├── Integrações  → Status hub + Gemini
├── Domínios     → Availability + Vercel
└── Dashboard    → (preservar)
```

**Princípio:** Manual e Gemini chamam o **mesmo backend** (`agent-tools` + handlers).

## What Can Be Reused

| Need | Reuse |
|------|-------|
| Tool execution | `agent-tools/executor.js` |
| Page CRUD | `funnel-engine/service.js` |
| Checkout | `checkout-builder.js`, `order-bumps.js` |
| Integrations | `integrations-store.js`, `save_offer_integrations` |
| Domains | `vercel-domains.js`, `register_funnel_domain` |
| Launch | `launch-readiness.js`, `validate_offer` |
| Funnel bootstrap | `setup_funnel_flow` tool |
| Templates | `seed-template.js`, `checkout-starter-template.js` |

## What Must NOT Change

- Onda Prodígio legacy checkout paths
- Stripe webhook contract
- `hub_orders` schema
- Page Engine block/section model
- Auth (`metricsAuth`)
- Supabase migrations aplicadas (additive only)

## What Needs Change (phases)

| Fase | Scope | Status |
|------|-------|--------|
| 1 | Audit + this doc | ✅ |
| 2 | Clean offer create + domain check | ✅ In progress |
| 3 | Funnel visual builder | ✅ Started (`funnel-flow.js`, `hub-funnel-ui.js`) |
| 4 | Pages + Page AI | ✅ Vertical slice (Pages Studio) |
| 5 | Multi-checkout UI + Stripe sync | ✅ Hub CRUD + sync por checkout_id |
| 6 | Quiz UX + AI | ✅ Builder montado no Hub + resultados |
| 7 | Community templates + AI | 🔲 |
| 8 | Tracking/Integrations AI unify | 🔲 |
| 9 | Recovery + Automations builders | 🔲 |
| 10 | Command Center ⌘K | 🔲 |

## APIs (AI-relevant)

| Action | Method | Purpose |
|--------|--------|---------|
| `hub_create_offer` | POST | Nova oferta vazia |
| `hub_check_domain` | GET | Disponibilidade domínio |
| `hub_gemini_chat` | POST | AI orchestrator |
| `hub_page_builder_ai_gemini` | POST | Page AI + tree |
| `hub_funnel_flow` | GET | Flow visual do funil |
| `hub_funnel_flow_save` | POST | Guardar sequência |
| `hub_module` | GET | Dados módulo |

## Security

- Secrets: nunca no contexto Gemini
- Tools: `logger.sanitizeInput()` redige keys
- Offer isolation: `guard()` em todos os tools
- Destructive ops: confirmação UI (em progresso)

## Template vs Data

| STRUCTURE (ok copiar como template) | DATA (nunca copiar) |
|-------------------------------------|---------------------|
| Module/lesson skeleton | Lesson content |
| Funnel step types | Onda funnel IDs |
| Checkout layout HTML/CSS | Stripe keys, prices |
| Page section types | Pixel IDs, tokens |
| Email sequence shape | Credentials |

## Tests Baseline

- Unit: 246+ (`npm test`)
- E2E: 19 (`npm run test:e2e`)
- Isolation: `integration-isolation.test.js`
- AI: `ai-orchestrator.test.js`

## Real Limitations (honest)

1. Funnel builder: flow em `funnel.settings.flow` — sem drag-reorder ainda
2. A/B variants: schema suporta `variant_page_ids`; UI parcial
3. Multi-checkout: schema OK, UI CRUD falta
4. Recovery/Automations: backend parcial, sem builder visual
5. Reference assets upload: não implementado
6. Streaming Gemini: só tool steps, não tokens
7. Command Center global: não existe

---

*Onda = referência. Novas ofertas = futuro do sistema.*
