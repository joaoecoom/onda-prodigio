# Fase 4B — Drag & Drop

**Estado:** ✅ Concluída  
**Depende de:** Fase 4A

---

## Objectivo

Adicionar **drag & drop** ao Visual Page Builder para reordenar e mover elementos sem usar apenas ↑↓.

---

## Funcionalidades

| Acção | Onde | Comportamento |
|-------|------|---------------|
| Reordenar sections | Page tree | Arrastar section sobre outra |
| Reordenar blocks | Page tree | Arrastar block sobre outro (mesma section) |
| Mover block entre sections | Page tree | Arrastar block para header de section |
| Add component | Components → Section | Arrastar componente para section na tree |

---

## Implementação

| Ficheiro | Função |
|----------|--------|
| `hub/editor-dnd.js` | HTML5 DnD (tree + components) |
| `lib/hub/page-builder/reorder.js` | Utilitários de ordenação |
| `lib/hub/page-builder/editor-state.js` | `reorderSectionsByIds`, `reorderBlocksByIds`, `moveBlockToSection` |
| `hub/editor.js` | Tree com handles ⋮⋮ + integração DnD |
| `hub/editor.css` | Estados dragging / drop-target |

---

## Persistência

Drag altera `sort_order` no estado local → **Save** → `tree-diff` emite `update_section` / `update_block` → Supabase.

---

## Não incluído (fases posteriores)

- Drag no canvas visual
- Drag entre pages/funnels
- Templates, AI, screenshot-to-page

---

## Testes

95 testes passam (incl. reorder + cross-section move + save).

---

## Próxima fase

**Fase 4C — Templates**
