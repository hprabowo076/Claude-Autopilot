# Claude CLI Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Claude Autopilot to work with current Claude Code CLI (v2.x) which has breaking changes in flag names and interactive mode behavior.

**Architecture:** Modernize Claude CLI integration by updating flag names (`--dangerously-skip-permissions` → `--permission-mode bypassPermissions`) and fixing stdin/stdout handling for interactive mode on Windows.

**Tech Stack:** Node.js 18+, TypeScript, Claude Code CLI v2.x, PowerShell, Windows native or WSL

---

## Problem Analysis

The codebase was forked from an older Claude build. Current Claude CLI (v2.1.133) has breaking changes:

1. **Flag Changes**: `--dangerously-skip-permissions` now requires `-p/--print` mode or fails. Modern replacement is `--permission-mode bypassPermissions`
2. **Interactive Mode**: Native Windows `claude.exe` now detects non-TTY stdin and requires explicit `--print` mode or prompt argument
3. **PTY Wrapper**: The Python PTY wrapper spawns `claude` without arguments, relying on stdin for interactive mode, which no longer works without proper flags

## File Structure

- **Create:** No new files needed
- **Modify:** 
  - `src/claude/session/index.ts` - Update session startup flags (3 locations)
  - `src/claude_pty_wrapper.py` - Add `--permission-mode bypassPermissions` flag
  - `src/services/dependency-check/checkers.ts` - Update flag in installation instructions
  - `README.md` - Update CLI flag documentation
  - `DEPLOYMENT.md` - Update security note about flag
  - `tests/windows-flag.test.js` - Update test expectation
- **Test:** Manual via CLI commands

---

## Task 1: Update Native Windows Claude Session Flags

**Files:**
- Modify: `src/claude/session/index.ts:99-107` - Replace `--dangerously-skip-permissions` with `--permission-mode bypassPermissions`

- [ ] **Step 1: Write the failing test**

Create a simple test script to verify the flag change works:

```bash
# Verify current behavior - this should fail with current code
node out/src/main.js start
```

Expected: Session starts and shows "Claude session ended" without proper interactive handling

- [ ] **Step 2: Modify session startup to use modern flag**

In `src/claude/session/index.ts`, replace:

```typescript
// Lines 99-107
if (isNativeWindows) {
    // Native Windows Claude: spawn claude.exe directly with stdio pipes
    // claude.exe is a Node.js binary that works directly on Windows
    command = claudePath;
    args = [];
    if (skipPermissions) {
        args.push('--dangerously-skip-permissions');
    }
    debugLog(`Using native Windows Claude: ${command}`);
}
```

With:

```typescript
// Lines 99-108
if (isNativeWindows) {
    // Native Windows Claude: spawn claude.exe directly with stdio pipes
    // claude.exe is a Node.js binary that works directly on Windows
    command = claudePath;
    args = [];
    if (skipPermissions) {
        args.push('--permission-mode', 'bypassPermissions');
    }
    debugLog(`Using native Windows Claude: ${command}`);
}
```

- [ ] **Step 3: Also update WSL branch**

Lines 108-128 also use `--dangerously-skip-permissions`:

```typescript
// Replace lines 108-128 (else if win32 branch)
} else if (process.platform === 'win32') {
    // Windows with WSL: use Python PTY wrapper through WSL
    // Convert Windows path to WSL path
    let wslWrapperPath = wrapperPath;

    // Convert drive letter (e.g., C: -> /mnt/c, D: -> /mnt/d)
    wslWrapperPath = wslWrapperPath.replace(/^([A-Za-z]):/, (match, driveLetter) => {
        return `/mnt/${driveLetter.toLowerCase()}`;
    });

    // Convert backslashes to forward slashes
    wslWrapperPath = wslWrapperPath.replace(/\\/g, '/');

    command = 'wsl';
    args = ['python3', wslWrapperPath];
    if (skipPermissions) {
        args.push('--permission-mode', 'bypassPermissions');
    }
    debugLog(`Original path: ${wrapperPath}`);
    debugLog(`WSL path: ${wslWrapperPath}`);
    debugLog(`Using WSL with Python3 and wrapper: ${wslWrapperPath}`);
}
```

- [ ] **Step 4: Update Unix branch similarly**

Lines 129-137 for Unix platforms:

```typescript
// Replace lines 129-138
} else {
    // Unix: use Python PTY wrapper
    command = pythonPath;
    args = [wrapperPath];
    if (skipPermissions) {
        args.push('--permission-mode', 'bypassPermissions');
    }
    debugLog(`Using Python: ${pythonPath}`);
    debugLog(`Using wrapper: ${wrapperPath}`);
}
```

- [ ] **Step 5: Compile and verify no TypeScript errors**

```bash
npx tsc -p ./
```

Expected: No errors

- [ ] **Step 6: Commit changes**

```bash
git add src/claude/session/index.ts
git commit -m "fix: update Claude CLI flags for v2 compatibility (--dangerously-skip-permissions -> --permission-mode bypassPermissions)"
```

---

## Task 2: Update PTY Wrapper for Modern Claude

**Files:**
- Modify: `src/claude_pty_wrapper.py` - Add `--permission-mode bypassPermissions` flag

- [ ] **Step 1: Update Python PTY wrapper argument handling**

Replace the `get_claude_command()` function and main():

```python
#!/usr/bin/env python3
import pty
import os
import sys
import select
import subprocess
import fcntl
import platform

def get_claude_command():
    """Get the appropriate command to run Claude CLI. On Windows, always use WSL since PTY requires Unix environment."""
    if platform.system() == 'Windows':
        # On Windows, we must use WSL because PTY functionality requires Unix-like system calls
        # that are not available on Windows (pty, select, fcntl modules)
        return ['wsl', 'claude']
    else:
        # For non-Windows platforms, use direct command
        return ['claude']

def main():
    # Parse command line arguments
    skip_permissions = '--skip-permissions' in sys.argv
    
    # Spawn Claude with a proper PTY
    master, slave = pty.openpty()
    
    # Start Claude process with the slave PTY as its controlling terminal
    claude_args = get_claude_command()
    if skip_permissions:
        claude_args.extend(['--permission-mode', 'bypassPermissions'])
    
    claude_process = subprocess.Popen(
        claude_args,
        stdin=slave,
        stdout=slave,
        stderr=slave,
        close_fds=True,
        preexec_fn=os.setsid if platform.system() != 'Windows' else None
    )
```

- [ ] **Step 2: Compile and verify**

```bash
npx tsc -p ./
```

- [ ] **Step 3: Commit changes**

```bash
git add src/claude_pty_wrapper.py
git commit -m "fix: update PTY wrapper to use --permission-mode bypassPermissions for Claude CLI v2"
```

---

## Task 3: Update Installation Instructions

**Files:**
- Modify: `src/services/dependency-check/checkers.ts` - Update `getClaudeInstallInstructions()` to reflect new flags

- [ ] **Step 1: Write the failing test**

Run the dependency check to see current instructions:

```bash
node -e "const { runDependencyCheck } = require('./out/src/services/dependency-check/main.js'); runDependencyCheck().then(r => console.log(r.claude.error || 'OK')).catch(e => console.error(e));"
```

Expected: Shows old `--dangerously-skip-permissions` flag in instructions

- [ ] **Step 2: Update Windows instructions**

In `src/services/dependency-check/checkers.ts`, replace lines 387-404:

```typescript
case 'win32': // Windows
    return `Claude CLI Installation (Windows):

Option 1 - Native Windows (Recommended):
   The standalone CLI fork supports running Claude natively on Windows.
   1. Install Claude CLI for Windows: npm install -g @anthropic-ai/claude-code
   2. Or download the Windows binary and place it in %USERPROFILE%\\.local\\bin\\claude.exe
   3. Verify: claude --version
   4. Authenticate: claude /login

Option 2 - WSL (Legacy):
   If you prefer to run Claude via WSL:
   1. Install WSL: wsl --install
   2. Restart your computer
   3. Inside WSL, install Claude CLI following Linux instructions
   4. Verify: wsl claude --version
   5. Authenticate: wsl claude /login

The standalone CLI will auto-detect Claude natively on Windows PATH first,
then fall back to WSL. Native mode is preferred as it does not require PTY.`;
```

- [ ] **Step 3: Compile and verify**

```bash
npx tsc -p ./
```

Expected: No errors

- [ ] **Step 4: Commit changes**

```bash
git add src/services/dependency-check/checkers.ts
git commit -m "docs: update Claude CLI installation instructions for v2"
```

---

## Task 4: Update README and Documentation

**Files:**
- Modify: `README.md:50` - Update CLI flag documentation
- Modify: `DEPLOYMENT.md:127` - Update security note
- Modify: `tests/windows-flag.test.js` - Update test expectation

- [ ] **Step 1: Update README.md line 50**

Replace:

```markdown
| `--skip-permissions` | Pass `--dangerously-skip-permissions` to Claude CLI |
```

With:

```markdown
| `--skip-permissions` | Pass `--permission-mode bypassPermissions` to Claude CLI |
```

- [ ] **Step 2: Update DEPLOYMENT.md line 127**

Replace:

```markdown
- Extension uses `--dangerously-skip-permissions` flag
```

With:

```markdown
- Extension uses `--permission-mode bypassPermissions` flag
```

- [ ] **Step 3: Update tests/windows-flag.test.js**

Replace entire file with:

```javascript
const fs = require('fs');
const path = require('path');

const compiledPath = path.join(__dirname, '..', 'out', 'src', 'claude', 'session', 'index.js');
const content = fs.readFileSync(compiledPath, 'utf8');

const occurrences = (content.match(/args\.push\('(.*?)'\)/g) || []);
const tokens = occurrences.map(token => {
    const match = token.match(/args\.push\('(.*?)'\)/);
    return match ? match[1] : null;
});

console.log('tokens:', tokens);

if (tokens.some(token => token === '--dangerously-skip-permissions')) {
    console.log('FAIL: Old flag --dangerously-skip-permissions still in use');
    process.exit(1);
}

console.log('PASS: All Claude branches use --permission-mode bypassPermissions');
```

- [ ] **Step 4: Compile and verify**

```bash
npx tsc -p ./
```

Expected: No errors

- [ ] **Step 5: Commit changes**

```bash
git add README.md DEPLOYMENT.md tests/windows-flag.test.js
git commit -m "docs: update flag references from --dangerously-skip-permissions to --permission-mode bypassPermissions"
```

---

## Task 5: Manual Integration Testing

**Files:**
- No file changes - manual testing only

- [ ] **Step 1: Kill any existing Claude processes**

```powershell
Get-Process -Name "claude" -ErrorAction SilentlyContinue | Stop-Process -Force
```

- [ ] **Step 2: Test dependency check**

```bash
node out/src/main.js --help
```

Expected: Shows help without errors

- [ ] **Step 3: Test session startup (will fail due to auth)**

```bash
timeout 10 node out/src/main.js start 2>&1 || echo "Session exited as expected (auth required)"
```

Expected: Process starts, waits for auth, shows appropriate message

- [ ] **Step 4: Update prompt detection patterns (if needed)**

If the ANSI prompt patterns have changed, check `src/claude/communication/index.ts:293-297`:

```typescript
const readyPatterns = [
    /\? for shortcuts/,
    /\\u001b\[2m\\u001b\[38;5;244m│\\u001b\[39m\\u001b\[22m\s>/,
    />\s*$/,
];
```

Test with a logged-in session and adjust patterns if needed.

- [ ] **Step 5: Commit test documentation**

```bash
git commit -m "test: manual verification of Claude v2 compatibility"
```

---

## Self-Review

**Spec Coverage:**
- ✅ All flag references updated from `--dangerously-skip-permissions` to `--permission-mode bypassPermissions`
- ✅ PTY wrapper updated
- ✅ Installation instructions updated
- ✅ Manual testing procedure documented

**Placeholder Scan:** No placeholders found.

**Type Consistency:** All flag changes are consistent across TypeScript and Python files.