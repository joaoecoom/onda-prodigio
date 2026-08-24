# Fase 5B — Autosave no Page Builder

Guardar automaticamente alterações no editor após período de inactividade, sem substituir o botão Save manual.

## Comportamento

| Evento | Acção |
|--------|--------|
| Alteração local (edit, DnD, undo/redo, template, AI, screenshot) | Status **Unsaved changes** + debounce **2,5 s** |
| Timer expira com alterações pendentes | `hub_page_builder_save` silencioso |
| Sucesso autosave | Flash **Auto-saved** (2 s) → **Saved** |
| Falha autosave | **Save failed** + reagenda debounce (sem alert) |
| Save manual | Alert em erro; limpa undo/redo (checkpoint) |
| Autosave | Preserva undo/redo |
| Já a guardar | Autosave reagenda |
| Sair com unsaved/saving | `beforeunload` avisa o browser |

## Debounce contínuo

Edição contínua no inspector (vários keystrokes na mesma selecção) usa `markDirty()` — após autosave, novas alterações voltam a marcar **unsaved** e re-disparam o debounce (**2,5 s após a última alteração**).

## Ficheiros

- `hub/editor.js` — `scheduleAutoSave`, `saveChanges({ auto: true })`, `beforeunload`
- `hub/editor.css` — `.peb-save-status.is-auto-saved`

## Fora de scope

- Autosave configurável por utilizador
- Offline queue / conflict resolution
- Version history

## Testes

Comportamento client-side; validar manualmente no editor ou via browser automation.

```bash
npm test
```
