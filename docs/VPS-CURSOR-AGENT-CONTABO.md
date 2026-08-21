# VPS Contabo — Cursor Agent Headless (HUB DR Ecoom)

**Data:** 17 Agosto 2026  
**VPS:** `169.58.161.136` (Contabo — **mesma máquina Evolution API / WhatsApp Onda Prodígio**)  
**NÃO usar:** VPS Taskforce (chave `~/.ssh/contabo-taskforce/` — servidor diferente, intocável)

---

## 1. Resumo executivo

| Item | Estado |
|------|--------|
| Auditoria VPS | ✅ Concluída |
| Node.js 22 | ✅ Instalado |
| Git | ✅ Já existia |
| Docker + Compose plugin | ✅ Já existia (Evolution WhatsApp) |
| Cursor CLI (`agent`) | ✅ Instalado (`2026.08.11-e8db854`) |
| Estrutura `/opt/hub-agent/` | ✅ Criada |
| Repositório clonado | ✅ `/opt/hub-agent/workspace/onda-prodigio` |
| Branch POC | ✅ `agent-proof-of-concept` |
| Worker script | ✅ `/opt/hub-agent/scripts/run-agent-task.sh` |
| Autenticação Cursor | ✅ `agent login` — `geral.joaoecoom@gmail.com` (Pro) |
| Teste real (criar ficheiro) | ✅ `TEST-CURSOR-AGENT.md` (2 runs) |
| Worker via `run-agent-task.sh` | ✅ `auth: cli_login`, exit 0 |
| Ligação HUB → VPS | ⏸ Fase futura (não implementada) |

---

## 2. Sistema operativo e recursos

| Recurso | Valor |
|---------|-------|
| **OS** | Ubuntu 24.04.4 LTS (Noble) |
| **Kernel** | 6.8.0-136-generic |
| **CPU** | x86_64, **4 cores** |
| **RAM** | **7.8 GiB** (~6.9 GiB disponível) |
| **Disco** | 96 GB total, **91 GB livres** (6% usado) |
| **Swap** | 0 B |
| **Utilizador** | `root` |
| **Firewall (ufw)** | Inactivo |
| **Portas em listen** | 22 (SSH), 8080 (Evolution API Docker) |

---

## 3. Software instalado / verificado

| Tool | Versão | Notas |
|------|--------|-------|
| **Node.js** | v22.23.2 | Instalado nesta fase (NodeSource) |
| **npm** | 10.9.8 | |
| **Git** | 2.43.0 | Já existia |
| **Docker** | 29.7.2 | Já existia (Evolution WhatsApp) |
| **Docker Compose** | v5.4.0 (plugin) | |
| **curl / wget / bash** | OK | |
| **Python** | 3.12.3 | |
| **pnpm / yarn** | Não instalados | Não necessários para POC |
| **Vercel CLI** | Não instalado | OK para esta fase (sem deploy) |
| **Cursor CLI** | `2026.08.11-e8db854` | `/root/.local/bin/agent` |

---

## 4. Cursor CLI — instalação e sintaxe

**Instalação oficial (executada):**
```bash
curl https://cursor.com/install -fsS | bash
```

**Verificação:**
```bash
agent --version   # 2026.08.11-e8db854
agent --help
```

**Modo headless (documentação actual Cursor):**
```bash
export CURSOR_API_KEY=...   # User API Key do dashboard Cursor
agent -p --trust --force --workspace /path/to/repo "prompt"
```

Flags relevantes (versão VPS):
- `-p, --print` — modo não-interactivo (scripts)
- `--force` / `--yolo` — permite editar ficheiros sem confirmação
- `--trust` — confia no workspace (headless)
- `--workspace <path>` — directório do projecto
- `--api-key` ou env `CURSOR_API_KEY`

**Teste sem credencial (resultado actual):**
```
Error: Authentication required. Please run 'agent login' first, or set CURSOR_API_KEY environment variable.
```

---

## 5. Autenticação Cursor (BLOQUEIO ACTUAL)

### Método recomendado para VPS headless

**User API Key** (conta Cursor Pro):

1. Abrir [Cursor Dashboard → API Keys](https://cursor.com/dashboard)
2. Gerar **User API Key**
3. Na VPS, criar ficheiro seguro:

```bash
cp /opt/hub-agent/secrets/cursor.env.example /opt/hub-agent/secrets/cursor.env
chmod 600 /opt/hub-agent/secrets/cursor.env
# Editar: CURSOR_API_KEY=...
```

4. Verificar:
```bash
source /opt/hub-agent/secrets/cursor.env
agent status
```

### O que NÃO fazer
- Não commitar a key no Git
- Não colocar no `RELATORIO-PROJECTO-HUB.md` nem neste doc
- Não usar OpenAI/Anthropic API separada nesta fase

### Alternativa (menos adequada para VPS)
- `NO_OPEN_BROWSER=1 agent login` — imprime URL; requer browser noutro dispositivo. Possível para setup inicial, mas **API key é melhor para automação**.

### Credencial necessária AGORA

**`CURSOR_API_KEY`** — User API Key da conta Cursor Pro.

Sem esta key, o teste POC (criar `TEST-CURSOR-AGENT.md`) **não pode ser concluído**.

---

## 6. Projecto Git na VPS

| Campo | Valor |
|-------|-------|
| **Remote** | `https://github.com/joaoecoom/onda-prodigio.git` |
| **Localização** | `/opt/hub-agent/workspace/onda-prodigio` |
| **Branch default clone** | `main` (sync com origin) |
| **Branch POC** | `agent-proof-of-concept` (criado localmente na VPS) |
| **Push para main** | ❌ Não feito (por design) |
| **Deploy / Supabase / Stripe** | ❌ Não alterados |

**Nota:** O clone veio do GitHub `main` remoto. Alterações locais no Mac (hub, integrações, etc.) **podem ainda não estar no GitHub** se não foram pushed.

---

## 7. Estrutura `/opt/hub-agent/`

```
/opt/hub-agent/
├── README.md
├── config/
│   └── worker.env              # WORKSPACE + BRANCH defaults
├── logs/                       # Logs por task (stdout/stderr/meta)
├── scripts/
│   └── run-agent-task.sh       # Executor de prompts
├── secrets/
│   ├── cursor.env.example
│   └── cursor.env              # ← CRIAR (600) com CURSOR_API_KEY
├── tasks/                      # Reservado: payloads futuros do HUB
├── worker/                     # Reservado: daemon/queue futuro
└── workspace/
    └── onda-prodigio/          # Git clone HUB DR Ecoom
```

---

## 8. Como executar uma task (quando tiveres API key)

```bash
ssh root@169.58.161.136

# Depois de configurar secrets/cursor.env:
/opt/hub-agent/scripts/run-agent-task.sh "Analisa o projecto HUB DR Ecoom e cria TEST-CURSOR-AGENT.md na raiz..."
```

O script:
1. Carrega `secrets/cursor.env`
2. Faz checkout do branch `agent-proof-of-concept`
3. Corre `agent -p --trust --force --workspace ...`
4. Guarda logs em `/opt/hub-agent/logs/task-YYYYMMDDTHHMMSS-PID.*`
5. Redacta `CURSOR_API_KEY` dos logs se vazar

---

## 9. Prompt do primeiro teste (POC)

Quando a API key estiver configurada, correr:

```bash
/opt/hub-agent/scripts/run-agent-task.sh "Analisa o projecto HUB DR Ecoom e cria um ficheiro chamado TEST-CURSOR-AGENT.md na raiz do projecto. O ficheiro deve conter: nome do projecto, stack detectada, principais tecnologias, principais pastas, resumo da arquitectura, data/hora da execução, indicação de que o ficheiro foi criado pelo Cursor Agent headless."
```

**Critérios de sucesso:**
- Ficheiro `TEST-CURSOR-AGENT.md` existe no branch `agent-proof-of-concept`
- Logs guardados em `/opt/hub-agent/logs/`
- Mac **não** precisou de estar ligado
- Cursor Desktop **não** necessário

---

## 10. Serviços já existentes na VPS (não alterados)

- **Evolution API** (WhatsApp Onda Prodígio): Docker em `/opt/evolution-whatsapp`, porta **8080**
- Cron jobs WhatsApp follow-up (campanhas anteriores)

Estes serviços **não foram modificados** nesta fase.

---

## 11. Limitações conhecidas (Cursor Pro)

| Tópico | Detalhe |
|--------|---------|
| **Plano** | Cursor Pro suporta CLI com **User API Key** (facturação/uso via conta Cursor) |
| **Sem API key** | Agent recusa execução headless |
| **Browser login** | `agent login` não é ideal para VPS sem GUI |
| **Mac agent status** | Também reporta "Not logged in" (CLI no Mac sem key/login activo) |
| **Versões agent** | Mac: `2026.05.05`; VPS: `2026.08.11` (instalador official) |
| **Enterprise** | Service accounts existem para equipas; Pro usa User API Key |
| **Rede** | VPS precisa de aceder a `api2.cursor.sh` |

---

## 12. Segurança — o que foi respeitado

- ❌ Sem deploy Vercel
- ❌ Sem migrations Supabase
- ❌ Sem alterações Stripe/Meta
- ❌ Sem push para `main`
- ❌ Sem secrets no Git
- ✅ Branch isolado `agent-proof-of-concept`
- ✅ Secrets em `/opt/hub-agent/secrets/` (chmod 700/600)
- ✅ Logs com redacção de API key

---

## 13. Próximos passos

### Imediato (desbloqueia POC)
1. **Fornecer `CURSOR_API_KEY`** (User API Key do dashboard Cursor)
2. Agente configura `secrets/cursor.env` na VPS
3. Executar teste POC + validar `TEST-CURSOR-AGENT.md`
4. Reportar logs e exit code

### Fase seguinte (após POC OK)
1. Instalar Vercel CLI (opcional, sem deploy auto)
2. Worker queue (ficheiros JSON em `/opt/hub-agent/tasks/`)
3. Systemd unit para worker passivo
4. **Depois:** API interna HUB → VPS (não agora)

### NÃO iniciar ainda
- Funnel Builder, Page Builder, OfferContext, multi-offer runtime, novos módulos HUB

---

## 14. Acesso SSH

- **Host:** `169.58.161.136` — **VPS WhatsApp / Evolution API** (Onda Prodígio)
- **User:** `root`
- **Hostname VPS:** `vmi3501828`
- **NÃO confundir com:** VPS **Taskforce** (outra máquina Contabo; chave em `~/.ssh/contabo-taskforce/` — **nunca mexer**)
- **Método usado nesta fase:** password SSH (mesmo acesso das sessões Evolution API)
- **Recomendação futura:** chave SSH dedicada hub-agent + desactivar password auth

### Serviços partilhados nesta VPS (WhatsApp intacto)

| Serviço | Path / porta | Estado verificado |
|---------|--------------|-------------------|
| Evolution API | `/opt/evolution-whatsapp`, porta **8080** | Deve manter-se activo — **não alterado** nesta fase |
| Hub Agent (novo) | `/opt/hub-agent/` | Instalado **em paralelo**, sem tocar no Docker WhatsApp |

---

## 15. Checklist critério de sucesso

| Passo | Estado |
|-------|--------|
| VPS ligada | ✅ |
| Cursor Agent CLI instalado | ✅ |
| Autenticação Cursor | ❌ Falta key |
| Projecto HUB no workspace | ✅ |
| Branch POC | ✅ |
| Prompt → Agent | ⏸ |
| Agent modifica projecto | ⏸ |
| Ficheiro TEST criado | ⏸ |
| Log guardado | ⏸ (script pronto) |
| Sem Cursor Desktop | ✅ (quando key existir) |

---

*Documento gerado após auditoria e instalação automática na VPS Contabo.*
