# Fase 2 — OfferContext + Multi-Offer (Relatório)

**Data:** 18 Agosto 2026  
**Branch:** `phase-2-offer-context`  
**Estado:** ✅ Concluída — critérios de sucesso cumpridos  
**Projecto Supabase:** `vmyezkbkthguojmxhacw`  
**VPS Worker:** `169.58.161.136` (Contabo WhatsApp — Evolution API intocável)

---

## A. Estado actual (antes da Fase 2)

| Área | Estado |
|------|--------|
| `hub_offers` | Existia com seed Onda Prodígio |
| Runtime checkout/tracking/comunidade | Global via `.env` |
| AI Tasks (Fase 1) | `offer_id` guardado mas **não usado** |
| Worker VPS | Workspace único hardcoded `onda-prodigio` |
| Domain → offer | `hub_offer_domains` escrito mas **nunca lido** |
| Onda Prodígio | Tratada como “projecto principal” implicitamente |

---

## B. Dependências encontradas

- **Stripe / checkout:** `lib/funnel-checkout-config.js`, `api/create-payment-intent.js` — env global (não migrado nesta fase)
- **Tracking:** `api/tracking-config.js` — env global → **adaptado** para OfferContext com fallback
- **Comunidade:** `products` + `member_products` por `product_id`, sem `offer_id` directo
- **AI worker:** path fixo + validação de um único workspace
- **Hardcodes Onda:** dezenas de referências em email, tracking, grant-access (mantidas — compatibilidade)

---

## C. O que mudou nesta fase

### CORE — OfferContext

Camada central: **`lib/hub/offer-context.js`**

```text
identifier (offer_id | slug | domain)
        ↓
resolveOfferContext()
        ↓
{
  offer, products, integrations (safe),
  tracking, community, workspace, agentContext
}
```

**Resolução suportada:**
- `offer_id`
- `slug`
- `domain` / `hostname` (via `hub_offer_domains` + colunas `funnel_domain` / URLs)

**Default offer:** primeira oferta `active` por `sort_order`, senão env fallback.

### Workspace resolver

**`lib/hub/workspace-resolver.js`**

```text
offer.agent_workspace_key
        ↓
/opt/hub-agent/workspaces/{key}/
```

- Legacy suportado: `/opt/hub-agent/workspace/{key}` (symlink Onda)
- Branch validada server-side (`agent_branch`)
- Paths `..`, `/etc`, etc. **rejeitados**

### AI Tasks + Worker

- **`lib/hub/ai-tasks.js`:** workspace/branch derivados de OfferContext (nunca do frontend)
- **`scripts/hub-agent/worker/poll-tasks.js`:** multi-offer, valida workspace vs offer_id, injecta contexto no prompt do Agent
- **`scripts/hub-agent/worker/offer-context-client.js`:** cliente VPS (sem secrets no prompt)

### Segunda oferta de teste

| Campo | Valor |
|-------|-------|
| ID / slug | `ai-test-offer` |
| Nome | AI Test Offer |
| Status | `draft` |
| Workspace VPS | `/opt/hub-agent/workspaces/ai-test-offer` |
| Stripe/Meta/domínio | Nenhum (teste isolado) |

---

## D. Riscos identificados e mitigação

| Risco | Mitigação |
|-------|-----------|
| Quebrar checkout Onda | Stripe/checkout **não alterados** nesta fase |
| Tasks antigas sem `offer_id` | Worker recusa (segurança) |
| Workspace errado | Validação server-side offer_id ↔ path |
| Secrets no prompt Agent | `sanitizeIntegrationsForAgent()` + regras explícitas |
| Git fetch em repo local | Worker ignora `origin` ausente |

---

## E. Migrations

| Ficheiro | Conteúdo |
|----------|----------|
| `064_offer_context.sql` | Colunas `agent_workspace_key`, `agent_branch`, `settings`; backfill Onda; insert `ai-test-offer` |

**Aplicada em:** `vmyezkbkthguojmxhacw` ✅

---

## F. Ficheiros criados

| Ficheiro | Função |
|----------|--------|
| `lib/hub/offer-context.js` | Resolução central OfferContext |
| `lib/hub/workspace-resolver.js` | Paths/branches autorizados |
| `scripts/hub-agent/worker/offer-context-client.js` | Contexto no worker VPS |
| `scripts/hub-agent/setup-workspaces.sh` | Setup workspaces na VPS |
| `tests/offer-context.test.js` | Testes workspace + agent context |
| `tests/offer-context-resolution.test.js` | Testes resolução id/slug/domain |
| `supabase/migrations/064_offer_context.sql` | Schema Fase 2 |
| `docs/FASE-2-OFFER-CONTEXT.md` | Este relatório |

## G. Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| `lib/hub/offers.js` | Novas colunas + defaults em create/fallback |
| `lib/hub/ai-tasks.js` | Workspace via OfferContext |
| `scripts/hub-agent/worker/poll-tasks.js` | Multi-offer + prompt contextual |
| `scripts/hub-agent/worker.env.example` | `HUB_AGENT_WORKSPACES_ROOT` |
| `scripts/hub-agent/worker-health.sh` | Verifica ambos workspaces |
| `api/tracking-config.js` | Resolve offer (slug/domain) + fallback env |
| `package.json` | Script `npm test` |

---

## H. Testes

### Automatizados (`npm test`)

15 testes — **todos passam** ✅

Cobertura:
1. resolveOfferContext por ID ✅
2. resolveOfferContext por slug ✅
3. resolveOfferContext por domain ✅
4. oferta inexistente ✅
5. oferta sem domínio (slug) ✅
6. workspace resolver ✅
7. isolamento de paths ✅
8. branch inválida rejeitada ✅
9. sanitize integrations (sem secrets) ✅
10. workspace inválido (`/etc`) ✅

### Isolamento real (VPS + Agent)

| Task | Oferta | Prompt | Resultado |
|------|--------|--------|-----------|
| `6b04abb2-…` | Onda Prodígio | Cria ONDA-OFFER-TEST.md | ✅ completed exit 0 |
| `a079895b-…` | AI Test Offer | Cria AI-TEST-OFFER.md | ✅ completed exit 0 |

**Verificação cross-workspace:**

| Ficheiro | Workspace Onda | Workspace AI Test |
|----------|----------------|-------------------|
| `ONDA-OFFER-TEST.md` | ✅ presente | ❌ ausente |
| `AI-TEST-OFFER.md` | ❌ ausente | ✅ presente |

**Worker:** `active` — Evolution API não afectada.

---

## I. OfferContext — estrutura

```javascript
{
  id, slug, name, status, mode,
  primary_product_id,
  site_url, funnel_url, funnel_domain, hub_domain,
  branding, settings,
  meta_accounts, checkouts, domains,
  products: [{ id, name, ... }],
  integrations: { /* non-secret or masked */ },
  tracking: { meta_pixel_id, ga4_measurement_id, ... },
  community: { primary_product_id, primary_product },
  workspace: {
    key: 'onda-prodigio',
    path: '/opt/hub-agent/workspaces/onda-prodigio',
    legacy_path: '/opt/hub-agent/workspace/onda-prodigio',
    branch: 'agent-proof-of-concept'
  },
  agentContext: '... texto seguro para o Agent ...'
}
```

---

## J. Como a Onda foi migrada

1. **Não recriada** — registo `onda-prodigio` existente actualizado com `agent_workspace_key`
2. **Workspace VPS:** symlink `workspaces/onda-prodigio` → `workspace/onda-prodigio` (repo existente)
3. **Runtime:** passa por `resolveOfferContext` — sem `if (onda-prodigio)` especial
4. **Checkout/Stripe/comunidade:** comportamento idêntico (env global mantido)
5. **Tracking-config:** lê OfferContext quando possível, fallback env

---

## K. AI Agent — estado pós-Fase 2

- Task **sempre** tem `offer_id` (default offer se UI não seleccionar)
- Worker valida workspace ↔ offer
- Prompt inclui contexto da oferta (nome, slug, produto, workspace, regras)
- **Sem** Stripe keys, service role, tokens no prompt
- Logs: `{logBase}.prompt.txt` guarda prompt completo na VPS

---

## L. Limitações (intencionais — Fase 2)

- **Stripe/checkout** ainda global — arquitectura preparada via `hub_offer_checkouts` mas não wired
- **Comunidade/members** ainda por `product_id`, não `offer_id`
- **Funil** ainda HTML estático partilhado — sem Funnel Engine
- **Integrações runtime** só parcialmente via OfferContext (tracking-config)
- **Deploy Vercel** desta branch — pendente validação manual
- **Tasks legacy** sem `offer_id` falham no worker (esperado)

---

## M. Próximos passos (Fase 3 — NÃO iniciada)

Fase 3 = **FUNNEL ENGINE + PAGE ENGINE**

Até lá: validar branch, merge manual, deploy quando conveniente.

---

## N. Comandos úteis

```bash
# Testes locais
npm test

# Setup workspaces VPS
bash /opt/hub-agent/setup-workspaces.sh

# Health worker
bash /opt/hub-agent/worker-health.sh
systemctl status hub-agent-worker
```

---

**Fase 2 concluída. PARAR aqui — Fase 3 não iniciada.**
