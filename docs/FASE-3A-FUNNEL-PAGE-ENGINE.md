# Fase 3A — Funnel Engine + Page Engine (Relatório)

**Data:** 18 Agosto 2026  
**Branch:** `phase-3a-funnel-engine`  
**Estado:** ✅ Concluída — critérios de sucesso cumpridos  
**Projecto Supabase:** `vmyezkbkthguojmxhacw`

---

## 1. Objectivo desta fase

Criar a **fundação de dados** para o Funnel Engine + Page Engine:

```text
Offer → Funnel → Page → Section → Block
```

**Não implementado nesta fase:** renderer, editor visual, AI builder, deploy Vercel, custom domains.

---

## 2. Modelo de dados

### Hierarquia

```text
hub_offers (Offer)
    └── funnels
            └── pages
                    └── page_sections
                            └── page_blocks
```

### Tabelas criadas

| Tabela | PK | FK principal | Notas |
|--------|----|--------------|-------|
| `funnels` | UUID | `offer_id → hub_offers` ON DELETE CASCADE | slug único por offer |
| `pages` | UUID | `funnel_id → funnels` CASCADE | `offer_id` denormalizado + trigger |
| `page_sections` | UUID | `page_id → pages` CASCADE | ordenação por `sort_order` |
| `page_blocks` | UUID | `section_id → page_sections` CASCADE | content/settings/styles JSONB |

### Status

| Entidade | Valores |
|----------|---------|
| Funnel | `draft`, `active`, `archived` |
| Page | `draft`, `published`, `archived` |

### Types

| Entidade | Valores |
|----------|---------|
| Funnel | `vsl`, `quiz`, `advertorial`, `webinar`, `lead`, `custom` |
| Page | `sales`, `vsl`, `landing`, `advertorial`, `checkout`, `upsell`, `downsell`, `thank_you`, `webinar`, `custom` |
| Block | `text`, `heading`, `image`, `video`, `button`, `spacer`, `html` |

### Versioning

- Coluna `version INT DEFAULT 1` em `funnels` e `pages`
- Sem histórico/revisões — **versionamento completo fica para fase posterior**

### Visibility (preparado)

```json
{ "desktop": true, "tablet": true, "mobile": true }
```

---

## 3. Migration

| Ficheiro | Descrição |
|----------|-----------|
| `065_funnel_engine.sql` | Schema + triggers + fixture AI Test Offer |

**Aplicada:** ✅ `vmyezkbkthguojmxhacw`

### Índices

- `idx_funnels_offer_status`
- `idx_funnels_offer_default`
- `idx_pages_funnel_sort`
- `idx_pages_offer_status`
- `idx_pages_funnel_status`
- `idx_page_sections_page_sort`
- `idx_page_sections_offer`
- `idx_page_blocks_section_sort`
- `idx_page_blocks_page`
- `idx_page_blocks_offer`

### Integridade (triggers PostgreSQL)

1. `page.offer_id` deve igualar `funnel.offer_id`
2. `section.offer_id` deve igualar `page.offer_id`
3. `block.offer_id` / `block.page_id` devem igualar `section`

### Unique constraints

- `(offer_id, slug)` em `funnels`
- `(funnel_id, slug)` em `pages`

Permite `sales` slug em Offer A e Offer B sem conflito.

---

## 4. Domain layer

**Localização:** `lib/hub/funnel-engine/`

| Ficheiro | Função |
|----------|--------|
| `constants.js` | Enums e defaults |
| `validation.js` | Validação pura (slug, types, JSON, ownership) |
| `repository.js` | CRUD Supabase |
| `service.js` | Domain layer + OfferContext validation |
| `index.js` | Exports públicos |

### Operações

**Funnels:** `createFunnel`, `getFunnel`, `listFunnels`, `updateFunnel`, `deleteFunnel`

**Pages:** `createPage`, `getPage`, `listPages`, `updatePage`, `deletePage`

**Sections:** `createSection`, `updateSection`, `deleteSection`, `reorderSections`

**Blocks:** `createBlock`, `updateBlock`, `deleteBlock`, `reorderBlocks`

**Tree:** `getPageTree(offerId, pageId)` — funnel + page + sections + blocks

### Validação server-side

Todas as operações:

1. Resolvem `OfferContext` (`offer_id` válido)
2. Verificam `entity.offer_id === offerId` solicitado
3. Impedem cross-offer (ex.: page em funnel de outra offer)

---

## 5. Ficheiros criados

```
supabase/migrations/065_funnel_engine.sql
lib/hub/funnel-engine/constants.js
lib/hub/funnel-engine/validation.js
lib/hub/funnel-engine/repository.js
lib/hub/funnel-engine/service.js
lib/hub/funnel-engine/index.js
tests/funnel-engine.test.js
docs/FASE-3A-FUNNEL-PAGE-ENGINE.md
```

**Ficheiros alterados:** `package.json` (script test já existia)

---

## 6. Fixture — AI Test Offer

### BD (verificado pós-migration)

| Métrica | AI Test Offer | Onda Prodígio |
|---------|---------------|---------------|
| Funnels | 1 | **0** |
| Pages | 1 | **0** |
| Sections | 2 | **0** |
| Blocks | 5 | **0** |

### Árvore

```text
AI Test Offer
└── AI Test Sales Funnel
    └── AI Test Sales Page
        ├── Hero (sort 100)
        │   ├── heading (100)
        │   ├── text (200)
        │   └── button (300)
        └── Benefits (sort 200)
            ├── heading (100)
            └── text (200)
```

**Isolamento confirmado:** Onda Prodígio não recebeu entidades do Funnel Engine.

---

## 7. Legacy coexistence

- Ficheiros HTML estáticos (`funnel/`, `checkout9/`, etc.) **intocados**
- Nenhuma migração automática de páginas Onda
- Funnel Engine coexiste em paralelo (`legacy_coexistence: true` no settings do fixture)

---

## 8. Testes

### `npm test`

```text
31 tests — 31 pass — 0 fail
```

| Suite | Testes |
|-------|--------|
| Fase 2 OfferContext | 15 |
| Fase 3A Funnel Engine | 16 |

### Cobertura Fase 3A

1. ✅ Criar funnel Offer A / B
2. ✅ Impedir funnel sem offer
3. ✅ Impedir page cross-offer
4. ✅ Criar page / section / blocks
5. ✅ Reorder sections
6. ✅ Reorder blocks
7. ✅ Update page + publish (`published_at`)
8. ✅ Draft status
9. ✅ Slug scoped por funnel/offer
10. ✅ Isolamento entre offers
11. ✅ Delete funnel (cascade memory)
12. ✅ getPageTree estrutura completa
13. ✅ Block types validados
14. ✅ content/settings/styles JSON
15. ✅ Validação block type inválido
16. ✅ AI Test Sales fixture structure (memory)

---

## 9. Compatibilidade

| Fase | Estado |
|------|--------|
| Fase 1 AI Tasks | ✅ Não alterada |
| Fase 2 OfferContext | ✅ 15 testes passam |
| Onda Prodígio runtime | ✅ Legacy HTML intacto |
| Worker / Contabo | ✅ Não alterado |

---

## 10. Segurança

- Sem endpoints públicos novos
- Domain layer valida cadeia offer → funnel → page → section → block
- IDs do frontend **não são trusted** isoladamente
- RLS activado (sem policies públicas — service role / futuro hub auth)

---

## 11. Limitações (Fase 3A)

- Sem renderer (HTML output)
- Sem editor visual / drag & drop
- Sem AI builder integration
- Sem publicação/deploy
- Sem custom domains routing para novas pages
- Versioning apenas contador — sem histórico
- Checkout/comunidade ainda legacy

---

## 12. Próxima fase — 3B (NÃO iniciada)

**FASE 3B — PAGE RENDERER**

```text
Page Schema → Renderer → Página real
```

Aguarda validação deste relatório.

---

**Fase 3A concluída. PARAR aqui.**
