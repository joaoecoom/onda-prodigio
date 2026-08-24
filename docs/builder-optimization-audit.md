# Auditoria — Construtor Inteligente (Page Builder)

> Scope: apenas builder. Outros módulos Hub fora de scope.

## Pipeline actual (antes desta optimização)

```
studio.js buildBody
  → hub-ai-panel.js POST hub_page_builder_ai_gemini
    → handlers/page-builder.js handleAiGemini
      → gemini-page-assistant.js chat
        → ai-orchestrator.js run
          → ai-context-engine.js buildPageContext (getPageTree DB)
          → gemini-assistant.js chat (até 3 rounds)
            → Gemini API (sequential tool calls)
            → agent-tools/executor.js (create_section + N× createBlock sequential)
        → loadTreeAfterRun (getPageTree DB again)
  → studio onComplete → loadTree + iframe refresh (?t=timestamp)
```

## Bottlenecks identificados

| # | Onde | Ficheiro | Problema |
|---|------|----------|----------|
| 1 | Contexto | `ai-context-engine.js` | `getPageTree` em cada mensagem mesmo com tree no cliente |
| 2 | Gemini rounds | `gemini-assistant.js` | Até 3 round-trips Gemini + tools |
| 3 | Tools | `executor.js` create_section | Blocks criados sequencialmente |
| 4 | Tools | `gemini-assistant.js` runToolCalls | Tools executadas em série |
| 5 | Pós-AI | `gemini-page-assistant.js` | Reload tree completo da BD |
| 6 | Preview | `studio.js` | iframe full reload + poll 1.8s durante AI |
| 7 | Fast path | — | `ai-assistant.js` local existia mas **studio nunca usava** |

## Ficheiros do builder

| Área | Ficheiros |
|------|-----------|
| Frontend | `hub/studio.html`, `hub/studio.js`, `hub/studio.css`, `hub/hub-ai-panel.js` |
| API | `lib/hub/handlers/page-builder.js` → `hub_page_builder_ai_gemini` |
| Orquestração | `lib/hub/page-builder/gemini-page-assistant.js`, `lib/hub/ai-orchestrator.js` |
| IA | `lib/hub/gemini-assistant.js`, `lib/hub/gemini-tool-bridge.js` |
| Contexto | `lib/hub/ai-context-engine.js`, `lib/hub/page-builder/ai-context.js`, `lib/hub/page-builder/builder-context.js` |
| Patch | `lib/hub/page-builder/patch-engine.js`, `patch-applier.js`, `ai-assistant.js` |
| Tools | `lib/hub/agent-tools/registry.js`, `executor.js` |
| Persistência | `lib/hub/page-builder/save.js`, `tree-diff.js` |
| Preview | `lib/hub/page-renderer/*`, `handlers/page-preview.js` |

## Métricas expostas (response.metrics)

- `scope_ms`, `fast_path_ms`, `db_write_ms`, `db_read_ms`
- `context_ms`, `gemini_ms`, `gemini_request_ms_N`, `tool_execution_ms_N`
- `total_ms`, `gemini_rounds`

## Optimizações implementadas (esta fase)

- **Fast path** — edições simples sem Gemini (`patch-engine.js`)
- **Contexto mínimo** — índice block_01 + bloco seleccionado (`builder-context.js`)
- **Tools paralelas** — `Promise.all` em runToolCalls
- **Blocks paralelos** — create_section nested blocks
- **Batch tool** — `apply_page_patches`
- **MAX rounds page_builder** — 2 (era 3)
- **Cliente envia tree** — evita reload contexto
- **Undo/redo** — studio ⌘Z / ⇧⌘Z
- **changes_summary** — feedback humano ("Headline actualizada")

## Fora de scope (registado)

- Funnel builder estrutural (`hub-funnel-ui.js`)
- Checkout, Stripe, Tracking, Dashboard, etc.
