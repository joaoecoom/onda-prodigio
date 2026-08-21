# FASE 3B — Page Renderer

**Estado:** concluída  
**Branch:** `phase-3b-page-renderer`  
**Depende de:** Fase 2 (OfferContext), Fase 3A (Funnel Engine)

---

## Objectivo

Transformar o **Page Schema** (Offer → Funnel → Page → Section → Block) em **HTML real** servido no browser, sem editor visual, sem AI builder, sem substituir o legacy Onda Prodígio.

---

## Arquitectura

```
OfferContext
    ↓
getPageTree() / getPageTreeBySlugs()
    ↓
getRenderablePage*()  — validação + draft/published
    ↓
PageRenderer → SectionRenderer → BlockRegistry → HTML
```

### Camada `lib/hub/page-renderer/`

| Ficheiro | Responsabilidade |
|----------|------------------|
| `load-page.js` | Resolver oferta, carregar árvore, validar ownership, draft/published |
| `page-renderer.js` | Documento HTML completo, page settings, SEO mínimo |
| `section-renderer.js` | Ordenar blocks, aplicar settings/visibility da section |
| `block-registry.js` | Registry central `BLOCK_RENDERERS` |
| `styles.js` | Whitelist de estilos inline seguros |
| `escape.js` | Escape HTML, URLs seguras, strip `<script>` |
| `visibility.js` | Classes CSS desktop/tablet/mobile |
| `index.js` | Exports públicos |

### Handler HTTP

- `lib/hub/handlers/page-preview.js`
- Acção API: `hub_page_preview` em `api/sales-attribution.js`

---

## Block Registry

```javascript
BLOCK_RENDERERS = {
  heading, text, image, video, button, spacer, html
}
```

Block desconhecido:

- **preview:** placeholder `Unsupported block: xyz`
- **production:** comentário HTML + omitido visualmente

---

## Block types implementados

| Type | Conteúdo | Segurança |
|------|----------|-----------|
| `heading` | text, level 1–6, alignment | Texto escapado — sem HTML arbitrário |
| `text` | text, alignment, `\n` → `<br>` | Texto escapado |
| `image` | src, alt, width, height, objectFit | URL validada |
| `video` | url, poster, aspectRatio, controls, autoplay, muted | URL validada |
| `button` | label, href, variant, target | `javascript:` bloqueado; `_blank` com `rel="noopener"` |
| `spacer` | height, mobileHeight | CSS inline seguro |
| `html` | raw HTML | **Escape hatch perigoso** — scripts removidos; aviso em preview |

---

## Rota de preview

### Rewrite Vercel (`vercel.json`)

```
/preview/:offer/:funnel/:page
  → /api/sales-attribution?action=hub_page_preview&offer=...&funnel=...&page=...&preview=1
```

### API directa

```
GET /api/sales-attribution?action=hub_page_preview
  &offer=ai-test-offer
  &funnel=ai-test-sales-funnel
  &page=ai-test-sales-page
  &preview=1
```

Alternativa por ID:

```
&page_id=<uuid>&offer_id=<uuid>&preview=1
```

---

## Segurança

1. **Ownership server-side:** slug → OfferContext → Funnel → Page; rejeita combinações cross-offer (`OFFER_MISMATCH`).
2. **Draft vs published:**
   - `published` → público
   - `draft` / `archived` → bloqueado sem `preview=1` ou auth HUB (`METRICS_DASHBOARD_PASSWORD`)
3. **URLs:** `javascript:`, `data:` perigosos rejeitados em links e media.
4. **HTML block:** isolado, documentado como risco; não usar como padrão.
5. **Estilos:** whitelist em `styles.js` — sem CSS arbitrário por block.

---

## Visibility

Settings da Fase 3A:

```json
{ "desktop": true, "tablet": true, "mobile": true }
```

Implementado via classes CSS + media queries em `visibility.js` (sem JS no browser).

---

## Page settings

Defaults em `page-renderer.js`:

- `maxWidth: 960px`
- `background: #ffffff`
- `spacing: 24px`
- `fontFamily: Inter, system-ui, sans-serif`
- `color: #111827`

SEO mínimo: `title`, `description`, `canonical` (se URL segura).

---

## Ficheiros criados

```
lib/hub/page-renderer/
  block-registry.js
  escape.js
  index.js
  load-page.js
  page-renderer.js
  section-renderer.js
  styles.js
  visibility.js
lib/hub/handlers/page-preview.js
tests/page-renderer.test.js
docs/FASE-3B-PAGE-RENDERER.md
```

## Ficheiros alterados

```
lib/hub/funnel-engine/service.js   — getPageTreeBySlugs + resolveOffer injectável
lib/hub/funnel-engine/repository.js — lookups por slug (Fase 3A, usados aqui)
api/sales-attribution.js           — acção hub_page_preview
vercel.json                        — rewrite /preview/...
```

---

## Testes

```bash
npm test
```

**Resultado:** 51 testes, 51 pass (31 Fases 2+3A + 20 page-renderer).

Cobertura page-renderer:

- 7 block types + html controlado
- ordenação sections/blocks
- árvore completa (Hero + Benefits)
- unknown block fallback
- draft/published
- cross-offer rejection
- safe button href
- visibility classes
- page settings

---

## Browser test (AI Test Offer)

Fixture em produção (Supabase `vmyezkbkthguojmxhacw`):

| Entidade | Slug |
|----------|------|
| Offer | `ai-test-offer` |
| Funnel | `ai-test-sales-funnel` |
| Page | `ai-test-sales-page` (status: `draft`) |

Conteúdo confirmado:

- **Hero:** heading, text, button (`Call to Action`)
- **Benefits:** heading, text

Render local com dados reais da BD: **HTTP 200**, sections na ordem correcta, blocks presentes.

> **Nota deploy:** As variáveis `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` no Vercel estão vazias no ambiente actual. A rota `/preview/...` em produção requer essas variáveis antes de funcionar end-to-end. O código e os testes unitários estão correctos.

---

## Compatibilidade

| Fase | Estado |
|------|--------|
| Fase 2 OfferContext | ✅ Usada em `load-page.js` |
| Fase 3A Funnel Engine | ✅ `getPageTree()`, `getPageTreeBySlugs()` |
| Legacy Onda (`funnel/`, `checkout9/`, etc.) | ✅ Intacto — nenhum ficheiro legacy alterado |

---

## Limitações (Fase 3B)

- Sem React — renderer gera HTML string (stack actual do projecto).
- Sem cache, sem CDN dedicado, sem custom domains automáticos.
- Sem tracking injectado nesta fase.
- Sem editor visual, drag & drop, AI builder.
- `html` block existe só para compatibilidade — evitar uso normal.
- Vídeo: `<video src>` genérico — integração YouTube/Vimeo fica para fase futura.

---

## O que falta para Fase 3C — AI Page Manipulation

1. Tools/handlers para o Cursor Agent criar e modificar:
   - Funnels, Pages, Sections, Blocks
2. Operações estruturadas (não prompts livres sobre SQL).
3. Integração com `ai_tasks` / worker para executar mutações no schema.
4. Validação + preview automático após mutações do agente.

**Não iniciar Fase 3C neste branch.**
