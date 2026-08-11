# Onda Prodígio — Relatório Estratégico Completo

**Período:** 15 Jul 2026 → 11 Ago 2026 (~4 semanas)
**Gerado:** 11 Ago 2026
**Uso:** colar no ChatGPT para análise estratégica

---

## 1. Resumo executivo

| Métrica | Valor |
|---|---|
| Vendas Stripe (checkout9 live) | **41** |
| Receita Stripe | **€559.00** |
| Gasto Meta Ads | **€292.76** ($319.12 USD) |
| ROAS real (Stripe ÷ Meta) | **1.91x** |
| Compras reportadas Meta (pixel) | 39 |
| Valor compras Meta (pixel) | €643.35 |
| Impressões Meta | 15,983 |
| Cliques Meta | 835 |
| CTR | 5.22% |
| CPC médio | €0.35 |
| CPA real (Meta ÷ vendas Stripe) | €7.14 |
| Ticket médio | €13.63 |
| Vendas atribuídas (UTM) | 36 |
| Vendas sem atribuição | 5 |
| Membros totais | 46 |
| Taxa login comunidade | 26% (12/46) |
| Pagamentos falhados | 199 |
| Taxa falha (falhados / tentativas) | 82.9% |

---

## 2. Meta — campanhas

| Campanha | Gasto € | Vendas Stripe | Receita € | ROAS real | Impressões | Cliques | Compras Meta |
|---|---:|---:|---:|---:|---:|---:|---:|
| CBO  1-5-1 | Conversão Normal | 187.50 | 14 | 206.00 | 1.10 | 10284 | 566 | 30 |
| 2 | CBO 1-5-1 | Conversão Normal | 62.85 | 3 | 37.00 | 0.59 | 3353 | 158 | 9 |
| CBO 1-5-1 | Conversão Normal — Cópia | 42.41 | 14 | 206.00 | 4.86 | 2346 | 111 | 0 |

---

## 3. Meta — anúncios (top 15 por gasto)

| Anúncio | Gasto € | Vendas | Receita € | ROAS |
|---|---|---:|---:|---:|
| 5 | 83.17 | 10 | 140.00 | 1.68 |
| 4 | 49.45 | 3 | 57.00 | 1.15 |
| 5.4 | 46.84 | 3 | 37.00 | 0.79 |
| 2 | 37.36 | 1 | 9.00 | 0.24 |
| 1 | 14.44 | 0 | 0.00 | 0.00 |
| 3 | 11.72 | 0 | 0.00 | 0.00 |
| 4 | 10.18 | 3 | 57.00 | 5.60 |
| 5 | 8.21 | 10 | 140.00 | 17.05 |
| 3 | 7.05 | 0 | 0.00 | 0.00 |
| 1 | 5.81 | 0 | 0.00 | 0.00 |
| 5.3 | 5.45 | 0 | 0.00 | 0.00 |
| 5.5 | 3.83 | 0 | 0.00 | 0.00 |
| 5.2 | 3.67 | 0 | 0.00 | 0.00 |
| 5.1 | 3.06 | 0 | 0.00 | 0.00 |
| 2 | 2.53 | 1 | 9.00 | 3.56 |

---

## 4. Stripe — vendas por anúncio (UTM)

| Anúncio | Vendas | Receita € |
|---|---:|---:|
| 5 | 10 | 140.00 |
| Desconhecido | 5 | 65.00 |
| 120246352475010317 | 4 | 76.00 |
| 120246352474990317 | 4 | 46.00 |
| 4 | 3 | 57.00 |
| 5.4 | 3 | 37.00 |
| 120246370518710317 | 2 | 18.00 |
| 52574484063459 | 2 | 23.00 |
| 2 | 1 | 9.00 |
| 120246352475000317 | 1 | 14.00 |
| 120247301926530179 | 1 | 14.00 |
| 120246370518700317 | 1 | 9.00 |
| 120246352475030317 | 1 | 14.00 |
| 52574484064059 | 1 | 14.00 |
| 52574484064259 | 1 | 9.00 |
| 52570847024259 | 1 | 14.00 |

---

## 5. Mix de preços (order bumps)

- **€9:** 21 vendas
- **€14:** 9 vendas
- **€19:** 4 vendas
- **€24:** 7 vendas

Bumps mais frequentes:
- só base (9€): 21
- tardes-sem-brigas, caixa-super-truques, grandes-mentes: 7
- grandes-mentes: 6
- caixa-super-truques: 3
- tardes-sem-brigas, grandes-mentes: 2
- caixa-super-truques, grandes-mentes: 1
- tardes-sem-brigas, caixa-super-truques: 1

---

## 6. Comunidade

- Membros: 46
- Com login: 12 (26%)
- Nunca login: 34
- WhatsApp enviado: 12

Produtos:
- onda-prodigio: 46 membros
- grandes-mentes: 17 membros
- tardes-sem-brigas: 12 membros
- caixa-super-truques: 12 membros

---

## 7. Pagamentos falhados

- Total: 199
- Contactáveis (tel): 14
- Recuperação WhatsApp: campanha activa (8 reais enfileirados)

Motivos:
- The PaymentIntent was declined by the provider. Provide a ne: 4x
- The customer did not approve the PaymentIntent. Provide a ne: 4x
- desconhecido: 3x
- Customer cancelled checkout on Klarna: 1x
- Customer was declined by Klarna: 1x
- The latest payment attempt for the PaymentIntent has expired: 1x

---

## 8. Funil & VSL / VTurb

**NÃO incluído automaticamente (ir buscar externamente):**

| Dado | Onde ir buscar |
|---|---|
| VTurb views / play rate / retenção VSL | Dashboard VTurb (player vid-6a7927038a043cc51fb71392) |
| VSL milestones (25/50/75/100%) | GA4 → eventos vsl_started, vsl_progress_*, vsl_completed |
| Sessões / tráfego site | GA4 |
| Stape / server-side events | Dashboard Stape |

**Funil técnico actual:**
Meta Ad → Landing (VSL VTurb) → Checkout9 → Obrigado (/obgd) → Comunidade

---

## 9. Contas & integrações

- Meta: **Onda Prodígio** `1078209721038923` (USD)
- Stripe: live checkout9 (Payment Intents)
- Supabase: membros, logins, WhatsApp logs
- VTurb: webhook conversão (server-side, sem read API)

---

## 10. Perguntas estratégicas para o ChatGPT

1. Com ROAS 1.91x em 4 semanas, devo escalar, optimizar criativos, ou pausar campanhas fracas?
2. Anúncio "5" gera 10 vendas — devo concentrar budget nele?
3. 74% dos membros nunca fizeram login — como priorizar onboarding vs aquisição?
4. 83% de tentativas falham no checkout — o que testar (Klarna, UX, preço, bumps)?
5. Bumps elevam ticket de €9 para €19-24 — como empurrar mais bumps sem matar conversão?
6. Que dados VTurb/GA4 preciso para fechar o funil VSL → checkout?
7. Vale a pena recuperar falhados (14 contactáveis) vs investir em tráfego novo?