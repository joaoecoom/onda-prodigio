# Fase 6A — HUB Shell v2 (referência Hotmart)

Redesign do shell do HUB DR Ecoom — sidebar, home por oferta e onboarding, mantendo visual dark premium.

## Inspiração

Estrutura tipo Hotmart (sidebar + home + progresso), sem copiar o tema claro — **HUB DR Ecoom continua dark**, mais denso e orientado a produto.

## Scope

- **Sidebar fixa** — grupos Marketing, Vendas, Automação, Plataforma
- **Home da oferta** — boas-vindas, barra de progresso, próximos passos, quick actions
- **Topbar** — título contextual + Actualizar / Sair
- **Navegação** — Home, módulos via sidebar, ← Todas as ofertas
- Deep links `?offer=&module=` continuam a funcionar

## Próximos passos (heurística)

1. Oferta criada ✓
2. Integrações (oferta `active`)
3. Funil / Page Engine (módulo live)
4. Tracking activo (módulo live)

## Ficheiros

- `hub/index.html`
- `hub/hub.css` (v8)
- `hub/hub.js` (v13)

## Fora de scope

- Notificações, pesquisa global, light theme toggle
- Wizard criar oferta multi-step
- Métricas nativas (iframe dashboard mantém-se)

## Testes

```bash
npm test
```

Validar manualmente: login → oferta → home → sidebar → funil/tracking.
