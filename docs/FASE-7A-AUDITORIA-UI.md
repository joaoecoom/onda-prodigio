# Fase 7A — Auditoria UI (pré-implementação)

**Data:** 18 Agosto 2026  
**Superfícies auditadas:** HUB, Editor, Checkout, Métricas (embed), login

---

## 1. Componentes existentes (HUB)

| Componente | Classes actuais | Ficheiro | Reutilizar? |
|------------|-----------------|----------|-------------|
| Button primary/ghost | `.hub-button`, `--primary`, `--ghost` | hub.css | ✅ refactor → tokens |
| Input | `.hub-login__input`, `.hub-field` | hub.css | ✅ |
| Card / Panel | `.hub-panel`, `.hub-offer` | hub.css | ✅ |
| Badge | `.hub-offer__badge`, `.hub-tag` | hub.css | ✅ → status system |
| Sidebar link | `.hub-sidebar__link` | hub.css | 🔄 redesenhar |
| Topbar | `.hub-topbar` | hub.css | 🔄 redesenhar |
| Avatar | `.hub-offer__avatar` | hub.css | ✅ |
| Onboarding | `.hub-onboard__*` | hub.css | 🔄 melhorar |
| Chat dock | `.hub-chat__*` | hub.css | ✅ manter |
| Status bar | `.hub-status` | hub.css | ✅ → toast |
| Module quick grid | `.hub-quick-card` | hub.css | ✅ |
| Form grid | `.hub-form-grid` | hub.css | ✅ |

## 2. CSS duplicado / tokens paralelos

| Superfície | Prefixo tokens | Valores base | Problema |
|------------|----------------|--------------|----------|
| HUB | `--hub-*` | #0c0a12, #a855f7 | Referência principal |
| Editor | `--peb-*` | idênticos | Duplicação |
| Checkout | `--ck-*` | similar | Duplicação parcial |
| Métricas | próprio | Inter, claro | Fora do dark DS |
| Page renderer | light Inter | público | Decisão produto: OK manter light |

**Acção:** `assets/platform.css` como fonte única; HUB/Editor importam e mapeiam aliases.

## 3. Inconsistências visuais

- **Emojis na nav** (`📦🎯📊🤖`) — não SaaS premium
- **Roxo excessivo** — glow em background, shadows com purple, borders accent everywhere
- **Login trust icons** — emojis 🔒📊⚡
- **AI module** — ✨ emoji no título
- **Mistura PT/EN** — "Save" no editor, "Actualizar" no HUB
- **Topbar** — sem breadcrumb, sem offer switcher dedicado
- **Sidebar** — sem collapse, categorias genéricas (Marketing/Vendas)
- **Offer home** — sem KPIs estruturados, onboarding usa `offer.status === active` como proxy de integrações
- **Sem command palette** — chat dock separado do ⌘K
- **Sem toast global** — `showStatus` inline só
- **Empty states** — texto genérico ("Sem funnels")

## 4. Componentes a criar

- Design tokens centralizados (`--dr-*`)
- Icon system SVG (Lucide-style inline)
- Status indicator (dot + label)
- Toast stack
- Command palette modal (⌘K)
- Empty state block
- Skeleton loaders
- Breadcrumb
- Offer switcher dropdown
- Sidebar collapsed mode

## 5. Páginas afectadas (Fase 7A/7B)

| Página | Alteração |
|--------|-----------|
| hub/index.html | Shell, switcher, topbar, command modal |
| hub/hub.css | Import platform, shell v2, menos glow |
| hub/hub.js | Nav groups, switcher, breadcrumbs, home, icons |
| hub/hub-chat.js | Integrar com command palette (opcional) |
| assets/platform.css | **NOVO** |
| assets/platform-icons.js | **NOVO** |
| assets/platform-ui.js | **NOVO** |

**Não alterar nesta fase:** editor profundo, checkout, comunidade, métricas standalone, public pages.

## 6. Riscos

| Risco | Mitigação |
|-------|-----------|
| Quebrar deep links `?offer=&module=` | Preservar `updateUrl` / `readBootstrapTarget` |
| Sidebar collapse quebra layout chat | Chat `position:fixed` full width |
| Regressão embed métricas/adm | Não tocar iframes |
| Testes npm | 132 testes backend — não afectados por CSS |

## 7. Dependências

- Plus Jakarta Sans (já carregada)
- Sem npm novo — icons inline SVG
- localStorage: sidebar collapsed, command history (opcional)

## 8. Ordem de implementação

1. platform.css + icons + ui  
2. hub/index.html structure  
3. hub.js nav + switcher + command  
4. hub.css shell v2  
5. Offer home + onboarding visual  
6. PT-PT pass  
7. npm test + QA manual
