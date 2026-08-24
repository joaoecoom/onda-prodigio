# Onda Prodígio HUB — Construtor Inteligente
## Documento de handoff (estado actual · Agosto 2026)

> **Para que serve este documento:** contexto completo para outro LLM (GPT, Cursor, etc.) escrever prompts e acelerar o desenvolvimento. Copia este ficheiro + indica a tarefa concreta.

---

## 1. Visão do produto

Queremos um **Construtor inteligente** estilo Cursor para páginas de funil — **só IA**, sem editor manual legacy como fluxo principal.

### Princípios UX (não negociáveis)

| # | Regra |
|---|-------|
| 1 | **Um único «Editar ↗»** no funil → abre `/studio/{offer}/{funnel}/{page}` |
| 2 | **Sem ecrã de login** intermédio ao abrir o studio (token em `localStorage`) |
| 3 | **Page vazia** — construir **bloco a bloco** via chat; sem Hero/Benefits/CTA pré-preenchidos |
| 4 | Sidebar **Blocos** — lista simples dos blocos criados (não árvore técnica heading/text/button) |
| 5 | Tab **Biblioteca** — guardar/reutilizar blocos, popups, scripts entre ofertas |
| 6 | **Enter = Executar** no chat |
| 7 | **Preview limpo** — sem overlay escuro, sem aviso «HTML block — conteúdo raw…» |
| 8 | **IA rápida** — poucos passos; replica referências visuais (cores, fundos, tamanhos) |
| 9 | Novos blocos **sempre abaixo** dos existentes |
| 10 | **Fundo do bloco** preto quando headline tem fundo preto |
| 11 | **Todas as etapas do funil** com botão «Editar ↗» visível |
| 12 | **Checkout** edita-se no módulo Checkout (não no Studio) |
| 13 | Idioma: **português europeu (pt-PT)** em UI e respostas da IA |

### O que NÃO queremos

- Editor legacy (`/editor/...`) como fluxo principal
- Templates automáticos Hero/Benefits/CTA ao criar page
- Dois botões separados «IA» + «Editar» no funil
- Árvore técnica de blocks na sidebar (heading, text, button separados)
- Preview com overlay escuro ou banners de aviso HTML

---

## 2. Ambiente & infra

| Item | Valor |
|------|-------|
| **Repo** | `/Volumes/Remote Nrl /Cursor/Projetos/Onda Prodigio` |
| **Produção HUB** | https://hub-dr-ecoom.vercel.app |
| **Marketing host** | onda-prodigio.vercel.app (redirect `/hub/*` → HUB) |
| **Supabase project ref** | `vmyezkbkthguojmxhacw` |
| **Supabase URL** | `https://vmyezkbkthguojmxhacw.supabase.co` |
| **Conta Supabase** | suporte.angelacampos@gmail.com |
| **Auth token** | `localStorage` key `onda-metrics-token` (partilhado hub ↔ studio) |
| **Deploy** | `vercel --prod` na raiz do repo |
| **Migrations** | `./scripts/apply-supabase-migration.sh supabase/migrations/NNN_nome.sql` |

> **Nota Supabase:** OAuth genérico (`user-supabase` / joaoecoom) falha frequentemente. Usar Management API ou script de migration com PAT de `.cursor/mcp.json`.

### Offer de teste habitual

- **Offer:** `fruta-da-epoca`
- **Funnel:** `teste`
- **Page:** `vsl`

---

## 3. Arquitectura geral

```
┌─────────────────────────────────────────────────────────────┐
│  HUB SPA  /hub/index.html + hub.js                          │
│  ├── Módulos: Funil, Checkout, Tracking, Domínios, etc.     │
│  └── Funil visual → hub-funnel-ui.js                        │
└──────────────────────────┬──────────────────────────────────┘
                           │ «Editar ↗»
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  STUDIO  /studio/{offer}/{funnel}/{page}                    │
│  studio.html + studio.js + hub-ai-panel.js                  │
│  ┌──────────┬──────────────┬─────────────────┐              │
│  │ Blocos   │  Chat IA     │  Preview iframe │              │
│  │Biblioteca│  (Gemini)    │  /preview/...   │              │
│  └──────────┴──────────────┴─────────────────┘              │
└──────────────────────────┬──────────────────────────────────┘
                           │ API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  /api/sales-attribution?action=hub_*                        │
│  lib/hub/handlers/page-builder.js                           │
│  lib/hub/gemini-assistant.js + agent-tools/executor.js      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase: funnels, pages, page_sections, page_blocks       │
│  funnels.settings.flow[] = fluxo visual do funil (JSONB)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. HUB — módulos e navegação

### Ficheiros principais

| Ficheiro | Função |
|----------|--------|
| `hub/index.html` | Shell SPA, login, sidebar |
| `hub/hub.js` | Router, estado offer/módulo, API client |
| `hub/hub-funnel-ui.js` | Builder visual de funil |
| `hub/hub-ai-panel.js` | Painel chat IA reutilizável |
| `lib/hub/modules.js` | Catálogo de módulos |

### Grupos de navegação

- **Visão geral:** Overview, Vendas (dashboard)
- **Construir:** Funis, Checkout, Comunidade
- **Crescer:** Tracking, Recuperação, Automações
- **Inteligência:** AI Agent
- **Sistema:** Integrações, Domínios, Definições

### Deep links

- `?offer={slug}&module={id}` — abre módulo directo
- `/funil?offer={slug}` — funil
- `/checkout-builder?offer={slug}` — checkout builder

---

## 5. Funil visual (`hub-funnel-ui.js`)

Export: `window.HubFunnelUI`

### Tipos de etapa

| kind | label | page_type | system |
|------|-------|-----------|--------|
| page | Página | sales | — |
| page | Pre Sell | presell | — |
| page | VSL | vsl | — |
| quiz | Quiz | quiz | — |
| checkout | Checkout | checkout | **sim** |
| upsell | Upsell | upsell | — |
| downsell | Downsell | downsell | — |
| thank_you | Thank You | thank_you | — |

### Fluxo por defeito

Sales → Checkout → Upsell → Downsell → Thank You

### Modelo de dados do fluxo

Guardado em **`funnels.settings.flow`** (JSONB, não tabela relacional):

```js
{
  id, kind, page_type, label, sort_order,
  active_page_id, variant_page_ids[],
  checkout_id: 'main',
  lane: 'main' | 'reject',
  parent_step_id,        // ramo «Não aceita ↓»
  is_step_active: boolean,
  active_page: { slug, name, ... }  // enriquecido server-side
}
```

### Funcionalidades implementadas

- Canvas horizontal com colunas por etapa
- Inserir etapas com `+` entre colunas
- Ramo **«Não aceita ↓»** (downsell reject)
- Dropdown page filtrado por `page_type` + «+ Criar page…»
- Toolbar: activar (●), duplicar, remover, mover ◀ ▶
- Modos: Seleccionar (V) vs Mão (M); pan com drag / space / middle-click
- Drag reorder (⋮⋮) em modo seleccionar
- Guardar: `hub_funnel_flow_save`

### Botão «Editar ↗» (implementado)

| Etapa | Comportamento |
|-------|---------------|
| Checkout | `/hub/?offer={slug}&module=checkout` |
| Page com slug | `/studio/{offer}/{funnel}/{page}` (nova aba) |
| Page sem ligar | «Editar ↗» desactivado + tooltip |

---

## 6. Studio — Construtor inteligente

### Ficheiros

| Ficheiro | Função |
|----------|--------|
| `hub/studio.html` | Layout 3 colunas |
| `hub/studio.js` | Boot, tree, biblioteca, preview poll |
| `hub/studio.css` | Estilos studio |
| `hub/hub-ai-panel.js` | Chat Gemini reutilizável |

### Rota

`/studio/{offer}/{funnel}/{page}` → rewrite `vercel.json` → `hub/studio.html`

Query params opcionais: `?name=&type=&prompt=`

### Layout

1. **Sidebar esquerda** — tabs «Blocos» / «Biblioteca»
2. **Centro** — chat IA (`HubAIPanel.mount()`)
3. **Direita** — preview iframe (`/preview/{offer}/{funnel}/{page}?preview=1`)

### Acções UI

| Acção | Comportamento |
|-------|---------------|
| Seleccionar bloco na sidebar | activa «💾 Guardar bloco» |
| ↺ Começar do zero | confirma → apaga sections → save API |
| ↻ Refresh preview | manual + poll 1.8s durante IA busy |
| Device toggles | desktop / tablet / mobile |

### Auth

- Sem token → redirect `/hub/`
- Token partilhado via `localStorage` (`onda-metrics-token`)

### Config IA (studio.js)

```js
mode: 'page_builder'
endpoint: POST /api/sales-attribution?action=hub_page_builder_ai_gemini
buildBody: { offer, funnel, page, page_id, selection, selected_section }
onComplete: reload tree + refresh preview
```

### Fix recente: «Começar do zero»

**Bug:** `saveEmptyPage()` usava `await` sem `async` → SyntaxError → script inteiro não carregava.

**Fix:** `async function saveEmptyPage()` + POST `hub_page_builder_save` com `baseline` + `tree` (sections vazias).

---

## 7. Modelo de dados — árvore da page

```
Offer (hub_offers)
 └── Funnel (funnels) — settings.flow[]
      └── Page (pages)
           └── Section (page_sections)  ← «bloco» na UI
                └── Block (page_blocks)  ← conteúdo técnico (heading, html, etc.)
```

### Resposta `hub_page_tree`

```js
{
  funnel: { id, slug, name, settings, ... },
  page: { id, slug, name, type, status, settings, seo, ... },
  sections: [
    {
      id, type, sort_order,
      settings: { label: "Nome humano do bloco" },
      styles: {}, visibility: {},
      blocks: [
        { id, type, content, settings, styles, sort_order, visibility }
      ]
    }
  ]
}
```

### Save (`hub_page_builder_save`)

Cliente envia `{ baseline, tree }` — servidor calcula diff (create/update/delete/reorder).

### Block types renderizados

`text`, `heading`, `image`, `video`, `button`, `spacer`, `html`

> **IA:** layouts ricos usam block type **`html`**. Sections tipo `custom` com blocks aninhados.

---

## 8. APIs principais

Gateway único: `/api/sales-attribution?action=...`  
Handler page engine: `lib/hub/handlers/page-builder.js`

### Funil & pages

| Action | Método | Uso |
|--------|--------|-----|
| `hub_funnel_flow` | GET | Carregar fluxo + pages |
| `hub_funnel_flow_save` | POST | Guardar fluxo |
| `hub_funnel_create` | POST | Novo funil |
| `hub_funnel_activate` | POST | Activar funil |
| `hub_funnel_duplicate` | POST | Duplicar |
| `hub_funnel_delete` | POST | Eliminar |
| `hub_page_create` | POST | Criar page |
| `hub_page_list` | GET | Listar pages |
| `hub_page_tree` | GET | Árvore completa |
| `hub_page_builder_save` | POST | Guardar diff |
| `hub_page_builder_publish` | POST | Publicar |
| `hub_page_revisions` | GET | Histórico |
| `hub_page_revision_restore` | POST | Restaurar |

### IA

| Action | Uso |
|--------|-----|
| `hub_page_builder_ai_gemini` | Chat page builder (Studio) |
| `hub_page_builder_ai` | Assistente rule-based (legacy) |
| `hub_page_builder_ai_agent` | Cursor agent task |
| `hub_gemini_chat` | Chat geral |
| `hub_gemini_status` | API key configurada? |

### Preview (público)

| Action / URL | Uso |
|--------------|-----|
| `hub_page_preview` | `/preview/{offer}/{funnel}/{page}?preview=1` |
| `hub_page_domain` | `/{funnel}/{page}` em domínio custom |

### Biblioteca de blocos

| Action | Uso |
|--------|-----|
| `hub_saved_blocks_list` | Listar (scope: all/offer/global) |
| `hub_saved_blocks_save` | Guardar bloco |
| `hub_saved_blocks_apply` | Inserir na page actual |
| `hub_saved_blocks_delete` | Eliminar |

Migration: `supabase/migrations/078_hub_saved_blocks.sql`  
Tabela: `hub_saved_blocks` (offer_id NULL = global)

---

## 9. IA — regras técnicas (page_builder)

Ficheiros: `lib/hub/gemini-assistant.js`, `gemini-tool-bridge.js`, `agent-tools/executor.js`

### Regras no prompt do sistema

- Contexto inclui `page_id` — **não chamar `get_page_tree`**
- Novos blocos: `create_section` type `"custom"` + `blocks[]` num único call
- Estilo rico: block type **`html`**, não hero/benefits/cta
- `heading`/`text`: texto simples (sem HTML inline excepto onde renderer suporta)
- `settings.label` = nome legível do bloco na sidebar
- `MAX_TOOL_ROUNDS = 3` (limitar latência)
- `sort_order` auto-append no final
- Auto `backgroundColor: #000` se HTML detecta fundo preto
- Respostas em **pt-PT**

### Tools disponíveis (page-relevant)

`create_section`, `update_section`, `delete_section`, `reorder_sections`, `create_block`, `update_block`, `delete_block`, `reorder_blocks`, `create_page`, `publish_page`, `apply_template`, etc.

Todos exigem `offer_id` scoped à offer autorizada.

---

## 10. Preview & renderer

Ficheiros: `lib/hub/page-renderer/`

- `page-renderer.js` — documento HTML completo
- `section-renderer.js` — section → HTML
- `block-registry.js` — renderers por tipo
- Modo preview: full-width, sem tracking, sem banner amarelo
- Modo produção: `/assets/tracking.js` + `data-offer-slug`

URLs (`lib/hub/page-builder/urls.js`):

| URL | Significado |
|-----|-------------|
| `/preview/{o}/{f}/{p}?preview=1` | Draft OK |
| `/p/{o}/{f}/{p}` | Só published |
| `https://{dominio}/{f}/{p}` | Live custom domain |

---

## 11. Supabase — tabelas relevantes

| Tabela | Notas |
|--------|-------|
| `hub_offers` | Offers (id = slug) |
| `funnels` | Funis + `settings.flow` JSONB |
| `pages` | Pages por funil |
| `page_sections` | Secções ordenadas |
| `page_blocks` | Blocks por secção |
| `page_revisions` | Snapshots (migration 067) |
| `hub_saved_blocks` | Biblioteca (migration 078) |
| `hub_offer_checkouts` | Checkout por offer |
| `hub_offer_domains` | Domínios custom |
| `quiz_*` | Engine quiz (075) |

Migrations chave: **065** (page engine), **067** (revisions), **075** (quiz), **077** (presell type), **078** (saved blocks)

---

## 12. Deploy & cache bust

`vercel.json` rewrites principais:
- `/studio/:offer/:funnel/:page` → `hub/studio.html`
- `/preview/:offer/:funnel/:page` → API
- `/hub/*` no host marketing → redirect HUB

Versões actuais (Agosto 2026):

| Asset | v |
|-------|---|
| hub.js | 55 |
| hub-funnel-ui.js | 16 |
| hub-ai-panel.js | 4 |
| studio.js | 9 |
| hub.css | 17 |
| hub-v2.css | 11 (index) / 12 (studio) |
| studio.css | 6 |

**Bump `?v=` sempre que alterares JS/CSS estático.**

---

## 13. O que está feito ✅

- [x] Funil visual horizontal com reorder, ramos reject, pan/zoom
- [x] Link único «Editar ↗» → Studio (todas etapas visíveis)
- [x] Studio 3 colunas: Blocos | Chat | Preview
- [x] Page vazia por defeito (sem templates legacy auto)
- [x] Chat Gemini page_builder com tools
- [x] Enter executa prompt
- [x] Preview limpo (sem overlay / aviso HTML)
- [x] Poll preview durante IA (~1.8s)
- [x] Biblioteca blocos (guardar/aplicar/eliminar)
- [x] Token localStorage (sem login intermédio studio)
- [x] «Começar do zero» funcional (fix async)
- [x] Checkout com Editar → módulo checkout
- [x] Headings com HTML inline renderizam
- [x] Novos blocos append no final (sort_order)
- [x] Migration 078 hub_saved_blocks aplicada

---

## 14. Backlog / problemas em aberto ⚠️

Prioridade alta — afectam a experiência «tipo Cursor»:

| # | Problema | Notas |
|---|----------|-------|
| 1 | **IA ainda lenta** | MAX_TOOL_ROUNDS=3 ajuda mas utilizador quer resposta quase instantânea |
| 2 | **Réplica visual incompleta** | Referências (headline colorida, fundos) nem sempre replicadas fielmente |
| 3 | **Persistência após refresh** | Verificar se blocos persistem correctamente após save + reload |
| 4 | **Título «Page» genérico** | Studio mostra «Page» quando meta não carrega |
| 5 | **Editar desactivado sem page** | Upsell/Downsell sem page seleccionada — ideal: criar page inline ao clicar Editar |
| 6 | **Checkout edit UX** | Link vai ao módulo; falta experiência «editar checkout» integrada no funil |
| 7 | **Quiz funnels** | UI stub quando `funnel.type === 'quiz'` |
| 8 | **Editor legacy** | `/editor/...` ainda existe — eventual deprecar |

---

## 15. Ficheiros-chave (mapa rápido)

```
hub/
  index.html          # SPA shell
  hub.js              # Router + modules
  hub-funnel-ui.js    # Funil visual
  hub-ai-panel.js     # Chat IA
  studio.html/js/css  # Construtor inteligente
  hub-gemini.js       # Chat geral Gemini
  editor.html/js      # Legacy (não usar como principal)

lib/hub/
  handlers/page-builder.js    # API handlers
  handlers/page-preview.js    # Preview HTML
  gemini-assistant.js         # Prompts + tool loop
  gemini-tool-bridge.js       # Tools por mode
  ai-orchestrator.js          # Run unificado
  agent-tools/                # registry + executor
  page-builder/save.js        # Diff save
  page-renderer/              # HTML output
  saved-blocks/service.js     # Biblioteca
  funnel-flow.js              # Default flow

api/sales-attribution.js      # Gateway API único
supabase/migrations/065-078   # Schema page engine
vercel.json                   # Rewrites + hosts
```

---

## 16. Meta Ads — UTMs (regra fixa)

Campo **Parâmetros de URL** em cada anúncio Facebook/Instagram:

```
utm_source=facebook&utm_medium=paid&utm_content={{ad.name}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}
```

- `{{ad.name}}`, `{{campaign.name}}`, `{{adset.name}}` preenchem automaticamente
- Se URL base já tiver `?`, usar `&` em vez de `?`

---

## 17. Template de prompt para GPT

Copia isto e preenche a secção **TAREFA**:

```
Contexto: Estou a desenvolver o Construtor Inteligente da Onda Prodígio HUB.
É um page builder estilo Cursor — só IA, bloco a bloco, preview live.

Stack: Vanilla JS frontend (hub/, studio/), Node API (/api/sales-attribution),
Supabase (vmyezkbkthguojmxhacw), Gemini para IA, Vercel deploy.

Regras UX:
- Um «Editar ↗» por etapa do funil → /studio/{offer}/{funnel}/{page}
- Page vazia, sem templates Hero/Benefits/CTA
- Sidebar lista blocos (sections), não árvore técnica
- IA usa create_section + blocks[] type html para layouts ricos
- pt-PT, poucos tool rounds, blocos novos no final
- Preview limpo, Enter executa

Ficheiros principais: hub/studio.js, hub/hub-funnel-ui.js, hub/hub-ai-panel.js,
lib/hub/gemini-assistant.js, lib/hub/handlers/page-builder.js

Produção: https://hub-dr-ecoom.vercel.app

TAREFA: [descreve aqui o que queres fazer]

Output esperado:
1. Lista exacta de ficheiros a alterar
2. Diff/pseudocódigo das mudanças
3. APIs afectadas
4. Como testar (offer fruta-da-epoca, funnel teste, page vsl)
5. Versões cache bust a incrementar
```

---

## 18. Histórico de decisões

| Decisão | Razão |
|---------|-------|
| Flow em JSONB (`funnels.settings.flow`) | Iteração rápida sem migrations por etapa |
| Section = «bloco» na UI | Utilizador pensa em blocos visuais, não em heading+text |
| Studio separado do HUB SPA | URL dedicada, preview full-screen, menos conflitos CSS |
| Token localStorage vs session | Studio abre em nova aba sem re-login |
| Removido auto-clear legacy templates | Apagava trabalho do utilizador após refresh |
| Checkout fora do Studio | Checkout é sistema universal `/checkout/?offer=slug` |
| html block vs component types | Flexibilidade total para IA replicar designs |

---

*Documento gerado em Agosto 2026. Branch activa na altura: `phase-3b-page-renderer`.*
