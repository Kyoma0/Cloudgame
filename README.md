# Cloudgame

Plataforma de Cloud Gaming self-hosted - Similar ao GeForce NOW, mas você controla tudo.

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────▶│  Sunshine   │────▶│   Jogo      │
│  (Browser)  │     │   (Host)    │     │  (Desktop)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │            ┌─────────────┐              │
       └───────────▶│ Cloudgame  │◀─────────────┘
                    │  Frontend  │
                    └─────────────┘
```

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind
- **Backend:** API integrada no Vite (FastAPI-like)
- **Streaming:** Sunshine (host) + Moonlight Web (cliente navegador)
- **Rede:** Tailscale (VPN mesh)

## Quick Start

### 1. Instalar dependências
```bash
npm install
```

### 2. Rodar em modo desenvolvimento
```bash
npm run dev
```
Acessar `http://localhost:3000`

### 3. Build para produção
```bash
npm run build
npm run dist:win  # Gera .exe para Windows
```

## Electron Client (App Desktop)

O projeto inclui um cliente Electron que permite:

- **Streaming no navegador** via Moonlight Web
- **Instalação automática** do Tailscale
- **Gerenciamento de sessões** integrado

### Rodar Electron
```bash
npm run electron:dev
```

### Gerar .exe
```bash
npm run dist:win
```

## Configuração

### Tailscale (Opcional)
Para acesso remoto, configure o Tailscale no host:

1. Instale o Tailscale no PC host
2. Configure a auth key
3. O cliente pode se conectar automaticamente

### Sunshine (Obrigatório no Host)
O Sunshine deve estar instalado e configurado no PC que vai rodar os jogos.

1. Baixe em: https://docs.lizardbyte.dev/projects/sunshine/latest/about/getting_started.html
2. Configure os jogos
3. O Moonlight Web se conecta ao Sunshine

### Moonlight Web Server
O servidor web para streaming no navegador já está incluso em `resources/`.

**Para iniciar manualmente:**
```bash
resources\start-moonlight-web.bat
```

**Ou pelo app Electron:**
1. Abra Settings > Rede
2. Clique em "Iniciar Servidor"
3. Clique em "Abrir no Navegador"

## Estrutura de Arquivos

```
cloudgame/
├── src/                    # Código React
│   ├── App.tsx            # Componente principal
│   └── electron.d.ts      # Tipos para Electron
├── electron/              # Processo principal Electron
│   ├── main/index.ts      # Entry point
│   └── preload.ts         # Bridge IPC
├── resources/             # Arquivos para distribuição
│   ├── moonlight-web-server.exe  # Servidor web
│   ├── moonlight-streamer.exe   # Streamer
│   └── static/            # Arquivos web
├── server_agent.py        # Agente Python (coleta stats)
└── package.json
```

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/queue/join` | Entrar na fila |
| GET | `/api/queue/status` | Status da fila |
| POST | `/api/launch` | Iniciar streaming |
| GET | `/api/user/library` | Biblioteca de jogos |
| POST | `/api/host/update` | Update stats (agent) |

## Desenvolvimento

### Comandos Disponíveis
```bash
npm run dev          # Dev server
npm run build        # Build frontend
npm run build:electron  # Build Electron
npm run electron:dev # Testar Electron
npm run dist:win     # Gerar instalador Windows
npm run lint         # Verificar TypeScript
```

### Adicionar Recursos ao Build
Coloque em `resources/`:
- `tailscale-setup.msi` - Installer do Tailscale
- `Moonlight.exe` - Cliente desktop Moonlight
- `icon.ico` - Ícone do app

## Problemas Comuns

| Problema | Solução |
|----------|---------|
| `database disk image is malformed` | Delete `gaming.db` e reinicie |
| Moonlight Web não conecta | Verifique se Sunshine está rodando |
| Latência alta | Use rede local ou Tailscale |

## Licença

MIT
