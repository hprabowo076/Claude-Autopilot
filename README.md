# Claude Autopilot — Standalone CLI Fork

[![Version](https://img.shields.io/badge/version-0.1.7-standalone-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Standalone fork** of [benbasha/Claude-Autopilot](https://github.com/benbasha/Claude-Autopilot). Strips VS Code / Cursor dependency. Runs as CLI tool or web server.

Queue tasks, process them sequentially via Claude Code CLI `-p` (print mode).

---

## Quick Start

### Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/setup) CLI installed and authenticated
- Node.js 18+

### Install

```bash
npm install -g .
# or
npm run compile
node out/src/main.js --help
```

### Usage

```bash
# Start queue processing
claude-autopilot start

# Add task to queue
claude-autopilot add "refactor the auth module to use hooks"

# Show queue status
claude-autopilot status

# Start web UI (Express server with WebSocket)
claude-autopilot serve
```

### Options

| Flag | Description |
|------|-------------|
| `--dir <path>` | Working directory (default: cwd) |
| `--skip-permissions` | Pass `--permission-mode bypassPermissions` to Claude CLI |

---

## How It Works

Each queued message spawns `claude -p <prompt>` as a separate subprocess. Claude processes prompt in print mode, writes response to stdout, exits. No persistent interactive session, no PTY wrapper.

Flow:
```
add "fix bug in login" → queue → claude -p "fix bug in login" → response stored → next message
```

Key details:
- Each message runs independently — no conversational context between queue items
- Claude must be authenticated: `claude /login` or set `ANTHROPIC_API_KEY`
- Compatible with Claude CLI v2.x — no Python or WSL dependency on Windows
- Timeout per message: 5 minutes (configurable in source)

---

## Features

- **Queue processing** — add tasks, process sequentially, review results
- **Print mode** — works with stock Claude CLI v2.x, no extra dependencies
- **Cross-platform** — Windows, macOS, Linux (Claude CLI must be on PATH)
- **Web UI** — Express + WebSocket interface for remote queue management
- **History tracking** — persists runs with filtering and status
- **Configurable** — JSON config file at `~/.claude-autopilot/config.json`

---

## Configuration

Config file: `~/.claude-autopilot/config.json`

```json
{
  "developmentMode": false,
  "session": {
    "autoStart": false,
    "skipPermissions": true
  },
  "sleepPrevention": {
    "enabled": true,
    "method": "auto"
  },
  "queue": {
    "maxSize": 1000,
    "maxMessageSize": 50000,
    "retentionHours": 24
  },
  "webInterface": {
    "useExternalServer": false,
    "password": ""
  }
}
```

---

## Architecture

```
src/
├── main.ts                     # CLI entry point (commander)
├── core/
│   ├── config/                 # Config reader/writer (JSON file)
│   ├── state/                  # Runtime state + file-based KV store
│   ├── workspace/              # Workspace abstraction (cwd + glob)
│   └── types/                  # Shared types
├── claude/
│   ├── session/                # runClaudePrint() — spawns claude -p <prompt>
│   ├── communication/          # Queue processing loop
│   └── output/                 # Output buffer for webview display
├── queue/                      # Message queue + history persistence
├── services/
│   ├── mobile/                 # Express + WebSocket web UI server
│   ├── health/                 # Process health monitoring
│   ├── sleep/                  # Platform sleep prevention
│   ├── scheduler/              # Scheduled session start
│   └── dependency-check/       # Claude CLI detection
├── ui/                         # Legacy VS Code webview (not used in CLI mode)
└── utils/                      # Logging, notifications, error handling
```

---

## Web Interface

```bash
claude-autopilot serve
```

Starts Express server with:
- WebSocket real-time queue/status updates
- File explorer and search
- Queue management (add, edit, reorder, duplicate)
- QR code for mobile access
- Optional ngrok tunnel for external access

---

## Development

```bash
git clone https://github.com/hprabowo076/Claude-Autopilot.git
cd Claude-Autopilot
npm install
npm run compile
node out/src/main.js --help
```

### Build binaries

```bash
npm run bundle
# Produces win-x64, linux-x64, macos-x64 binaries in dist/
```

---

## License

MIT — original by [Ben Basha](https://github.com/benbasha). Forked for standalone use.

*Claude Autopilot is not affiliated with Anthropic. Claude Code is a product of Anthropic.*