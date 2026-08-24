# Fase 5A — Page Publish & URLs públicas

Publicar páginas do Page Engine e servir versão live sem `?preview=1`.

## Scope

- **Publish / Unpublish** no editor (guarda alterações pendentes + muda status)
- URL pública **`/p/:offer/:funnel/:page`** para pages `published`
- Preview draft continua em **`/preview/...?preview=1`**
- Módulo Funil no HUB mostra link **Live** quando publicada

**Fora de scope:** custom domains por oferta, deploy Vercel automático, CDN.

## URLs

| Rota | Acesso |
|------|--------|
| `/preview/:offer/:funnel/:page?preview=1` | Draft + published (banner preview) |
| `/p/:offer/:funnel/:page` | Apenas **published** (público) |

## API

| Acção | Método | Body |
|-------|--------|------|
| `hub_page_builder_publish` | POST | `{ status: 'published' \| 'draft', baseline?, tree? }` |

`hub_page_tree` inclui `public_url`.

## Fluxo editor

```
Publish → save (se tree enviada) → updatePage(status)
  → reload tree → botão Live activo
Unpublish → status draft → /p/ bloqueado
```

## Ficheiros

- `lib/hub/page-builder/publish.js`
- `lib/hub/page-builder/urls.js`
- `lib/hub/handlers/page-builder.js`
- `vercel.json` — rewrite `/p/...`
- `hub/editor.html`, `hub/editor.js`, `hub/hub.js`
- `tests/page-builder-publish.test.js`

## Testes

```bash
npm test
```
