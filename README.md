# Claude Autopilot — Standalone CLI Fork

[![Version](https://img.shields.io/badge/version-0.1.7-standalone-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Standalone fork** of [benbasha/Claude-Autopilot](https://github.com/benbasha/Claude-Autopilot). Strips VS Code / Cursor dependency. Runs as a CLI tool or web server.

Queue hundreds of tasks, process them 24/7 with auto-resume across Claude usage limits.

---

## Quick Start

### Prerequisites

- [Claude Code](https://www.anthropic.com/claude-code) CLI installed and authenticated
- Python 3.8+ (for PTY process wrapper)
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

## Features

- **24/7 processing** — queue tasks, walk away, come back to results
- **Auto-resume** — detects Claude usage limits, waits, and resumes automatically
- **Sleep prevention** — keeps machine awake during long runs (macOS/Linux/Windows)
- **Smart queue** — add, edit, reorder, duplicate, remove messages
- **Health monitoring** — detects stalled Claude processes and recovers
- **Web UI** — full Express + WebSocket interface for remote control
- **History tracking** — persists runs with filtering and status tracking

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
│   └── types/                  # Shared types + vscode stubs
├── claude/                     # Claude CLI process management
├── queue/                      # Message queue + history persistence
├── services/
│   ├── mobile/                 # Express + WebSocket web UI server
│   ├── health/                 # Process health monitoring
│   ├── sleep/                  # Platform sleep prevention
│   ├── scheduler/              # Scheduled session start
│   └── dependency-check/       # Claude/Python/wrapper validation
├── ui/                         # Webview (legacy, not used in CLI mode)
└── utils/                      # Logging, notifications, error handling
```

---

## Web Interface

```bash
claude-autopilot serve
```

Starts Express server on random port with:
- WebSocket real-time queue/status updates
- File explorer and search
- Queue management (add, edit, reorder)
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

---

## License

MIT — original by [Ben Basha](https://github.com/benbasha). Forked for standalone use.

*Claude Autopilot is not affiliated with Anthropic. Claude Code is a product of Anthropic.*