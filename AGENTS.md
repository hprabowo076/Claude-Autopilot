# Claude Autopilot - Agent Guide

## Development Commands

```bash
npm run compile  # Build TypeScript to out/
npm run bundle   # Build + create binaries in dist/
```

## Verification Order

1. `npx tsc -p ./` - TypeScript compilation (must pass)
2. `npx eslint out/src/**/*.js` - Lint check

## Architecture

- **Entry point:** `src/main.ts` (CLI with `start`, `add`, `serve`, `status` commands)
- **Workspace:** `src/core/workspace/standalone-workspace.ts` - defaults to `process.cwd()` if `--dir` not provided
- **Web server:** `src/services/mobile/` (Express + WebSocket)
- **Claude session:** `src/claude/session/index.ts` - spawns `claude.exe` or uses PTY wrapper for WSL

## Key Quirks

- **Git status endpoint** (`/api/git/status`) returns empty status for non-git workspaces (intentional)
- **File tree** ignores protected Windows dirs: `AppData`, `ElevatedDiagnostics`, `System Volume Information`, etc.
- **Binary assets** in `dist/` are gitignored and published via GitHub releases only
- **No test framework** - manual verification via server endpoints

## Windows-Specific

- `buildFileTree()` catches `EPERM` errors on protected folders
- `getWorkspaceInfo()` falls back to `getWorkspaceRoot()` before `process.cwd()`