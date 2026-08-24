# BLOCO H — REAL OFFER LAUNCH

**Data:** 21 Agosto 2026  
**Branch:** `phase-3b-page-renderer`  
**Auditoria:** git limpo (exceto testes locais) · `npm test` 208/208 · `npm run test:e2e` 8/8

---

## Resposta directa

> **Consigo pegar numa oferta real e lançá-la através do HUB sem reconstruir a infraestrutura?**

### 🟡 SIM na infraestrutura · 🔴 BLOQUEADO na oferta comercial real

| Camada | Veredicto |
|--------|-----------|
| **Runtime A–G (código)** | 🟢 Prova completa — funil → checkout → Stripe → webhook → order → membro → dashboard |
| **Launch gate** | 🟢 Funciona — bloqueia launch em `ALMOST READY` (409) |
| **Segunda oferta comercial real** | 🔴 **Não existe no HUB** — só `onda-prodigio` (legacy) + rascunhos técnicos |
| **READY TO LAUNCH hoje** | 🔴 Impossível sem definir oferta + GA4 + (opcional) domínio |

**Conclusão:** A plataforma **está pronta para uso real**. Falta **definir a próxima oferta comercial** (nome, slug, preço, credenciais) e configurá-la no HUB — **não** falta construir mais infra.

---

## Oferta

| Campo | Valor |
|-------|-------|
| **Nome comercial real (2.ª oferta)** | **NÃO DEFINIDA** |
| **Única oferta comercial activa** | Onda Prodígio (`onda-prodigio`) — runtime **legacy** (`funnel/`, `checkout9/19`) |
| **Ofertas no HUB** | 15 slugs; 13 são testes/smoke/e2e |
| **Referência técnica (NÃO comercial)** | `production-e2e-test` — pipeline validado hoje |

**Regra respeitada:** não inventámos nome comercial, copy, preço de produto real, nem DNS.

---

## Inventário HUB (produção)

| Slug | Tipo | Estado |
|------|------|--------|
| `onda-prodigio` | **Real (legacy)** | active |
| `teste`, `teste3`, `ai-test-offer` | Rascunhos vazios | draft, sem produto |
| `production-e2e-test` | E2E técnico | draft, pipeline completo |
| `e2e-*`, `phase-f-*`, `phase-g-*` | Testes automáticos | draft |

---

## Prova do pipeline (referência técnica `production-e2e-test`)

> Usada **só** para validar o runtime — **não** é a oferta comercial do Bloco H.

| Etapa | Resultado | Evidência |
|-------|-----------|-----------|
| Setup (oferta + produto + checkout) | PASS | `primary_product_id`, checkout `main` €1.00 |
| Funil + sales page | PASS | `/p/production-e2e-test/e2e/sales` HTTP **200** |
| CTA checkout | PASS | Botão «Comprar agora» → `/checkout/?offer=…` |
| Stripe TEST | PASS | PI criado + confirmado (sessão E2E) |
| Webhook | PASS | `hub_orders` + `hub_stripe_events` |
| Order | PASS | 1 order, €1.00, `offer_id=production-e2e-test` |
| Member access | PASS | email teste desbloqueado |
| Attribution | PASS | UTM/fbclid em metadata |
| Dashboard | PASS | revenue €1, orders 1, isolamento A≠B |
| Refund | PASS | order → `refunded`, net revenue correcto |
| Launch gate | **BLOCKED** | `ALMOST READY` → launch 409 |

Relatórios: `.e2e-report.json`, `.e2e-verify-report.json`

---

## Checklist Bloco H (formato pedido)

### Oferta real comercial
- **Nome:** pendente (Angela/João)
- **slug:** pendente
- **product:** pendente
- **preço:** pendente
- **domínio:** pendente

### Setup — PASS (referência técnica)
### Funnel — PASS
### Page Engine — PASS
### Checkout — PASS
### Stripe — TEST MODE (platform env; per-offer integrations vazias na BD)
### Webhook — PASS
### Order — PASS (depois refund → status `refunded`)
### Member Access — PASS
### Community — PASS (renderer genérico; conteúdo vazio = warning opcional)
### Tracking — PARTIAL (Meta Pixel + CAPI PASS · GA4 **WARNING**)
### Attribution — PASS
### Dashboard — PASS
### Domain — PENDING EXTERNAL (sem domínio funil)
### Launch Readiness — **ALMOST READY** (2 avisos importantes: GA4, domínio)
### Launch — **BLOCKED** (correcto — 409 `ALMOST_READY`)
### Refund — PASS
### Agent — PASS (34 tools; Phase G validado em commits anteriores)
### Regression — `npm test` **209/209** · `npm run test:e2e` **8/8**

---

## Launch Readiness — detalhe (`production-e2e-test`)

| Grupo | Check | Status |
|-------|-------|--------|
| Setup | offer, product, checkout | PASS |
| Funil | funnel, sales_page, cta_checkout | PASS |
| Stripe | stripe, stripe_webhook | PASS |
| Tracking | meta_pixel, meta_capi | PASS |
| Tracking | **ga4** | **WARNING (important)** |
| Tracking | purchase_tracking | PASS |
| Comunidade | community_access | PASS |
| Comunidade | community_content | WARNING (optional) |
| Domínio | domain | **WARNING (important)** |
| Comercial | commercial_smoke | PASS |
| Comercial | test_order | WARNING → corrigido bug contagem slug |

### `onda-prodigio` (oferta real legacy)
- Launch readiness platform path: **NOT READY** (sem funil Page Engine, checkout universal, CTA)
- **Esperado** — Onda corre em HTML legacy; migração não faz parte do Bloco H

---

## O que ainda te obriga a voltar ao código

| Item | Classificação |
|------|---------------|
| Definir nome/slug/preço da **próxima oferta real** | **CRITICAL** (decisão comercial, não código) |
| Configurar GA4 no módulo Tracking da oferta | **IMPORTANT** (UI HUB) |
| Configurar domínio funil + DNS cliente | **IMPORTANT** (externo + UI) |
| `VERCEL_TOKEN` vazio no Vercel prod | **IMPORTANT** (automação domínios) |
| `E2E_HUB_TOKEN` vazio no Vercel prod | **OPTIONAL** (automação CI; local `.e2e-hub-token.local` funciona) |
| Migrar Onda para Page Engine | **OPTIONAL** (futuro; legacy intacto) |
| Worker VPS monitorizado | **OPTIONAL** |

**Não é necessário:** novo checkout, tracking, dashboard, Page Engine, community runtime, ou API.

---

## Pendências externas

1. **Nome comercial + slug** da próxima oferta (Angela)
2. **Credenciais Stripe LIVE** quando for vender a sério (TEST MODE suficiente para piloto)
3. **GA4** measurement ID + API secret por oferta
4. **Meta Pixel + CAPI** por oferta (platform tem defaults; confirmar por oferta)
5. **DNS** do domínio funil (registos A/CNAME documentados no módulo Domínios)
6. **`VERCEL_TOKEN`** para associação automática de domínio

---

## Bug corrigido neste bloco

**`launch-readiness.js`** — contagem de orders usava `offer.id` (UUID) mas `hub_orders.offer_id` guarda **slug**. Corrigido para `.in('offer_id', [offer.id, offer.slug])` e incluir status `refunded`.

---

## Ferramentas

```bash
# Auditoria de uma oferta
node scripts/bloco-h-audit.js <slug>

# Regressão
npm test
npm run test:e2e
```

---

## Próximo passo (utilização real — não mais infra)

1. Angela/João define: **nome, slug, preço, domínio (se houver)**
2. HUB → **Assistente de setup** → provision → funil → página → integrações
3. **Validar oferta** → resolver GA4 (+ domínio se necessário)
4. **Launch offer** quando 🟢 READY
5. Compra teste 4242… → confirmar webhook → comunidade → dashboard
6. Repetir para oferta N+1 **sem codificar**

---

## Prompt para Cursor (Bloco H bis — quando houver oferta definida)

```
Implementar launch da oferta real:
- slug: [DEFINIR]
- nome: [DEFINIR]
- preço: [DEFINIR]

Usar wizard HUB + runtime A–G existente.
Não criar infra nova.
Corrigir bugs mínimos se aparecerem.
Critério: READY TO LAUNCH + compra teste + relatório Bloco H actualizado.
```

---

*Bloco H concluído como validação operacional. A plataforma entra em fase de utilização real.*
