# Fase 5C — Version History (snapshots)

Histórico de versões da página no Page Builder — restore seguro com backup automático.

## Scope

- Snapshots JSONB da árvore completa (`getPageTree`) em **`page_revisions`**
- Criados em **Save manual** e **Publish** (não em autosave)
- Painel **History** no editor — listar + restaurar
- Restore grava snapshot **Before restore** antes de aplicar versão antiga
- Máximo **30 revisões** por página (prune automático)

**Fora de scope:** diff visual entre versões, labels editáveis, restore de status publish.

## API

| Acção | Método | Body / query |
|-------|--------|----------------|
| `hub_page_revisions` | GET | `offer`, `funnel`, `page` |
| `hub_page_revision_restore` | POST | `{ revision_id, tree }` |
| `hub_page_builder_save` | POST | `create_revision: true` (save manual) |

## Fluxo restore

```
Click revision
  → snapshot estado actual (source: restore)
  → saveTree(current, revision.tree)
  → reload editor + history
```

## Ficheiros

- `supabase/migrations/067_page_revisions.sql`
- `lib/hub/page-builder/revisions.js`
- `lib/hub/handlers/page-builder.js`
- `hub/editor.html`, `hub/editor.js`, `hub/editor.css`
- `tests/page-builder-revisions.test.js`

## Migration

```bash
./scripts/apply-supabase-migration.sh supabase/migrations/067_page_revisions.sql
```

## Testes

```bash
npm test
```
