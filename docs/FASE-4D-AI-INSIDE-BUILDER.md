# Fase 4D — AI inside Page Builder

Assistente de linguagem natural integrado no editor visual.

## Scope

- Painel AI no editor (botão **AI** na top bar)
- **Modo Rápido:** interpretação local de comandos comuns → alterações instantâneas no state local
- **Modo Agent:** cria `ai_task` com contexto da página → VPS Cursor Agent → MCP tools → Supabase → reload
- Persistência: modo rápido marca **Unsaved**; utilizador faz **Save**. Modo Agent auto-save antes da task.

**Fora de scope:** screenshot-to-page (4E), OpenAI inline, copywriter avançado.

## Modo Rápido — exemplos

| Prompt | Acção |
|--------|-------|
| `Muda a headline para …` | Actualiza heading seleccionado ou primeiro heading |
| `Muda o texto para …` | Actualiza block text |
| `Muda o botão para …` | Actualiza label do button |
| `Adiciona secção CTA` | Aplica template `cta-simple` |
| `Adiciona block heading` | Novo block na section activa |
| `Aplica template sales-basic` | Append page template |
| `Apaga o selecionado` | Remove block/section seleccionado |

## API

| Acção | Método | Body |
|-------|--------|------|
| `hub_page_builder_ai` | POST | `{ prompt, tree, selected }` |
| `hub_page_builder_ai_agent` | POST | `{ prompt }` + query slugs |

## Ficheiros

- `lib/hub/page-builder/ai-assistant.js`
- `lib/hub/page-builder/ai-context.js`
- `lib/hub/handlers/page-builder.js`
- `hub/editor-ai.js`
- `hub/editor.html`, `hub/editor.js`, `hub/editor.css`
- `tests/page-builder-ai.test.js`

## Fluxo Agent

```
Editor → save (se unsaved)
  → hub_page_builder_ai_agent
  → ai_tasks (task_type: page_builder)
  → VPS worker → Cursor Agent → MCP
  → Supabase
  → editor poll → hub_page_tree reload
```

## Testes

```bash
npm test
```

## URL

`/editor/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page`
