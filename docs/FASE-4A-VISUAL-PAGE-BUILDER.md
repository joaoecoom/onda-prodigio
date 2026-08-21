# Fase 4A — Visual Page Builder Core

**Estado:** ✅ Concluída (código + testes)  
**Depende de:** Fases 2, 3A, 3B, 3C

---

## Objectivo

Editor visual sobre o **Page Schema existente** (sem segundo modelo):

```text
Offer → Funnel → Page → Section → Block
```

---

## Arquitectura

```text
                    PAGE BUILDER (hub/editor.html)
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
       Sidebar         Canvas       Inspector
       (tree +         (PageRenderer  (forms por
        components)     via API)      block/section)
                         │
                    Local state
                    undo/redo
                         │
                    Save (explicit)
                         │
              lib/hub/page-builder/save.js
                         │
              lib/hub/funnel-engine (domain)
                         │
                    Supabase
```

### Backend

| Ficheiro | Função |
|----------|--------|
| `lib/hub/handlers/page-builder.js` | API autenticada |
| `lib/hub/page-builder/scope.js` | Resolução OfferContext + slugs |
| `lib/hub/page-builder/editor-state.js` | Estado local + undo/redo (testável) |
| `lib/hub/page-builder/tree-diff.js` | Diff baseline → mutations |
| `lib/hub/page-builder/save.js` | Persistência via funnel-engine |
| `lib/hub/page-builder/defaults.js` | Defaults blocks + component library |

### API (`sales-attribution.js`)

| Acção | Método | Descrição |
|-------|--------|-----------|
| `hub_page_tree` | GET | Carregar árvore |
| `hub_funnel_list` | GET | Listar funnels |
| `hub_page_list` | GET | Listar pages |
| `hub_page_render` | POST | Tree JSON → HTML body |
| `hub_page_builder_save` | POST | Guardar diff |
| `hub_page_builder_cross_offer` | POST | Validação isolamento |

### Frontend

| Ficheiro | Função |
|----------|--------|
| `hub/editor.html` | Shell 3 colunas |
| `hub/editor.js` | Lógica editor |
| `hub/editor.css` | UI profissional dark |
| `hub/hub.js` | Módulo Funil → picker → editor |

---

## Rotas

| URL | Função |
|-----|--------|
| `/editor/:offer/:funnel/:page` | Editor visual |
| `/preview/:offer/:funnel/:page?preview=1` | Preview draft |
| HUB → Funil → Editar visualmente | Entrada via módulo |

---

## Estado local

- `baseline` — última versão guardada (servidor)
- `tree` — working copy
- `undoStack` / `redoStack` — snapshots em memória (sessão)
- `saveStatus` — saved | unsaved | saving | error
- IDs temporários `tmp-*` para entidades novas até Save

---

## Persistência

1. Edições locais + preview via `hub_page_render`
2. **Save explícito** → `tree-diff` → mutations → funnel-engine
3. Resposta devolve tree actualizada → novo baseline

Sem autosave na 4A.

---

## Canvas

Usa **o mesmo PageRenderer** (`renderPageBody`) — paridade total com preview.

---

## Critérios de sucesso (4A)

| # | Critério | Estado |
|---|----------|--------|
| 1 | Rota editor | ✅ |
| 2 | Page carrega do Page Engine | ✅ |
| 3 | Canvas usa PageRenderer | ✅ |
| 4–5 | Selecção section/block | ✅ |
| 6–7 | Add block/section | ✅ |
| 8–9 | Editar conteúdo + settings | ✅ |
| 10–11 | Save + preview | ✅ |
| 12–13 | Undo/redo | ✅ |
| 14–16 | Duplicate/delete/reorder | ✅ |
| 17 | Desktop/tablet/mobile width | ✅ |
| 18 | Offer isolation | ✅ |
| 19 | Onda intacta | ✅ (sem alterações legacy) |
| 20 | Testes | ✅ 91/91 |

---

## Limitações (4A)

- Sem drag & drop (4B)
- Sem templates, AI UI, screenshot, media upload
- Undo/redo só na sessão
- Responsive = largura canvas (sem overrides)
- HTML block fora da biblioteca principal
- Save explícito (sem autosave)

---

## Validação produção (18 Agosto 2026)

| Teste | Resultado |
|-------|-----------|
| Deploy Vercel | ✅ |
| `GET hub_page_tree` | ✅ |
| `GET /editor/...` | ✅ HTTP 200 |
| `POST hub_page_render` | ✅ |
| Browser: editor + Save | ✅ |
| Preview pós-save | ✅ `4A Browser Test Headline` |

**URLs live:**

- Editor: https://hub-dr-ecoom.vercel.app/editor/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page
- Preview: https://hub-dr-ecoom.vercel.app/preview/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page?preview=1

---

## Próxima fase

**Fase 4B — Drag & Drop** → ✅ Ver `FASE-4B-DRAG-DROP.md`

**Fase 4C — Templates**
