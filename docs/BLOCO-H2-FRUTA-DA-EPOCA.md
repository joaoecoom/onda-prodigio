# BLOCO H2 — Fruta da Época (Order Bumps Universal)

**Data:** 21 Agosto 2026  
**Oferta:** Fruta da Época · `fruta-da-epoca` · €10 + 3 bumps €2

---

## Auditoria inicial — Order Bumps

| Sistema | Order bumps |
|---------|-------------|
| Checkout universal (`/checkout/`) | ❌ **Não suportava** |
| Legacy `checkout9/` + `order-bumps.js` | ✅ Hardcoded Onda (€9 + €5×3) |
| `api/update-payment-intent.js` | ✅ Legacy only (env `STRIPE_BUMP_AMOUNT_CENTS`) |

**Conclusão:** Extensão mínima necessária no runtime universal — **implementada**, sem sistema paralelo.

---

## Implementação

| Componente | Alteração |
|------------|-----------|
| `074_hub_offer_order_bumps.sql` | Tabela `hub_offer_order_bumps` |
| `lib/hub/order-bumps.js` | Resolver bumps por oferta, totais, metadata |
| `lib/hub/checkout-resolver.js` | `resolveUniversalCheckoutWithBumps` |
| `api/config.js` | Expõe `orderBumps[]` no checkout |
| `api/create-payment-intent.js` | `selected_bump_ids` → total server-side |
| `api/update-payment-intent.js` | Bumps universal com validação |
| `checkout/` | UI bumps dinâmica + total |
| `lib/comunidade/grant-access.js` | Acesso main + bump products |
| `lib/tracking/constants.js` | Items from `order_items` metadata |
| `scripts/setup-fruta-da-epoca.js` | Provision oferta + funil + página |

---

## URLs (produção)

| | URL |
|---|-----|
| Sales page | https://onda-prodigio.vercel.app/p/fruta-da-epoca/vendas/sales |
| Checkout TEST | https://onda-prodigio.vercel.app/checkout/?offer=fruta-da-epoca&mode=test |

---

## Totais validados (server-side)

| Cenário | Total | Status |
|---------|-------|--------|
| €10 sem bumps | 1000 | PASS |
| €12 bump 1 | 1200 | PASS |
| €14 bumps 1+2 | 1400 | PASS |
| €16 bumps 1+2+3 | 1600 | PASS |
| Bump outra oferta | rejeitado | PASS |
| Produto outra oferta | rejeitado | PASS |

---

## Segurança

- Backend recebe `selected_bump_ids` — **nunca** `amount` do browser como fonte de verdade
- Bumps validados contra `hub_offer_order_bumps` + `offer_id`
- Produtos validados via `assertProductBelongsToOffer`

---

## Order metadata

```json
order_items: [{ type, product_id, bump_id, label, amount_cents }, ...]
order_bumps: "bump-1, bump-2"
bump_product_ids: "fruta-da-epoca-bump-1, ..."
```

---

## Testes

```bash
npm test                    # 216/216
node scripts/test-fruta-checkout-amounts.js
node scripts/setup-fruta-da-epoca.js   # idempotente
npm run test:e2e
```

---

## Pendente pós-deploy

1. Compra Stripe TEST €10 e €16 (browser ou script)
2. Launch readiness — configurar GA4 se necessário para 🟢 READY
3. Validar dashboard revenue após compras teste

---

## Comandos úteis

```bash
node scripts/bloco-h-audit.js fruta-da-epoca
node scripts/test-fruta-checkout-amounts.js
```
