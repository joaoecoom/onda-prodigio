# Fase 4E — Screenshot → Page

Converte um screenshot de landing page em sections/blocks do Page Schema.

## Scope

- Upload de screenshot no editor (PNG/JPG/WebP, máx. 4MB)
- Análise via **OpenAI Vision** quando `OPENAI_API_KEY` está configurada
- **Fallback** estrutural (`sales-basic`) quando vision indisponível
- Sections **append** à página actual → **Save** persiste via tree-diff

**Fora de scope:** substituir página inteira sem confirmação, upload de media para CDN, pixel-perfect clone.

## Fluxo

```
Screenshot upload
  → POST hub_page_builder_screenshot
  → vision (ou fallback)
  → normalize schema
  → materialize temp IDs
  → append ao editor state
  → Save
```

## API

| Acção | Método | Body |
|-------|--------|------|
| `hub_page_builder_screenshot` | POST | `{ image_base64, mime_type }` + query slugs |

Resposta:

```json
{
  "source": "vision|fallback",
  "summary": "...",
  "confidence": "high|medium|low",
  "notes": "...",
  "sections": [ ... ]
}
```

## Configuração Vision

```bash
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-4o-mini   # opcional
```

Sem API key → fallback automático com aviso na UI.

## Ficheiros

- `lib/hub/page-builder/screenshot/schema.js`
- `lib/hub/page-builder/screenshot/vision.js`
- `lib/hub/page-builder/screenshot/analyze.js`
- `hub/editor-screenshot.js`
- `tests/page-builder-screenshot.test.js`

## Testes

```bash
npm test
```

## URL

`/editor/ai-test-offer/ai-test-sales-funnel/ai-test-sales-page`
