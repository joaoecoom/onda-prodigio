# Fase 4C — Templates (Page Builder)

Catálogo estático de templates para acelerar a criação de páginas no editor visual.

## Scope

- Catálogo em código (`lib/hub/page-builder/templates/catalog.js`)
- Aplicar template **adiciona sections** à página actual (não substitui sem confirmação)
- Persistência via **Save** existente + `tree-diff`
- **Fora de scope:** marketplace, DB de templates, AI, screenshot-to-page

## API

| Acção | Método | Descrição |
|-------|--------|-----------|
| `hub_page_templates` | GET | Lista page + section templates |
| `hub_page_template_materialize` | POST `{ template_id }` | Devolve sections materializadas com IDs temporários |
| `hub_page_tree` | GET | Inclui `templates` no payload do editor |

## Catálogo

### Section templates

- `hero-standard` — headline + texto + CTA
- `benefits-list` — título + lista de benefícios
- `cta-simple` — CTA final
- `social-proof` — testemunho curto

### Page templates

- `sales-basic` — Hero + Benefits + CTA
- `sales-minimal` — Hero only
- `sales-full` — Hero + Benefits + Social Proof + CTA

## Fluxo no editor

```
Sidebar Templates → click
  → POST hub_page_template_materialize
  → append sections ao state local
  → undo stack
  → Save → hub_page_builder_save
```

## Ficheiros

- `lib/hub/page-builder/templates/catalog.js`
- `lib/hub/page-builder/templates/apply.js`
- `lib/hub/handlers/page-builder.js`
- `hub/editor.html`, `hub/editor.js`, `hub/editor.css`
- `tests/page-builder-templates.test.js`

## Testes

```bash
npm test
```

## URLs de validação

- Editor: `/editor/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page`
- Preview: `/preview/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page?preview=1`
