import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
    claudeProcess, sessionReady, setClaudeProcess, setSessionReady,
    setCurrentMessage, setProcessingQueue
} from '../../core/state';
import { debugLog, formatTerminalOutput, sendToWebviewTerminal } from '../../utils/logging';
import { getErrorMessage } from '../../utils/error-handler';
import { showInfo, showError, showWarning, Messages } from '../../utils/notifications';
import { updateWebviewContent, updateSessionState } from '../../ui/webview';
import { sendClaudeOutput } from '../../claude/output';

/**
 * Find the Claude CLI executable on the system.
 * Searches PATH first, then ~/.local/bin/ and other common locations.
 */
export function findClaudeExecutable(): string | null {
    // Try PATH first using platform-appropriate command
    try {
        const shell = process.platform === 'win32' ? 'cmd.exe' : 'sh';
        const shellArgs = process.platform === 'win32'
            ? ['/c', 'where claude 2>nul']
            : ['-c', 'which claude 2>/dev/null'];
        const whichResult = execFileSync(shell, shellArgs, {
            encoding: 'utf-8',
            timeout: 5000
        }).trim().split('\n')[0];
        if (whichResult) {
            debugLog(`Found Claude on PATH: ${whichResult}`);
            return whichResult;
        }
    } catch {
        debugLog('Claude not found on PATH');
    }

    // Check common install locations
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const candidates = [
        path.join(home, '.local', 'bin', 'claude'),
        path.join(home, '.local', 'bin', 'claude.exe'),
        path.join(home, 'AppData', 'Local', 'claude', 'claude.exe'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            debugLog(`Found Claude at: ${candidate}`);
            return candidate;
        }
    }

    debugLog('Claude executable not found');
    return null;
}

/**
 * Run a single Claude prompt in print mode.
 * Spawns `claude -p <prompt> --permission-mode bypassPermissions`,
 * captures stdout, and returns the response string.
 */
export async function runClaudePrint(
    prompt: string,
    skipPermissions: boolean = true
): Promise<string> {
    debugLog('=== RUN CLAUDE PRINT MODE ===');

    const claudePath = findClaudeExecutable();
    if (!claudePath) {
        const errMsg = 'Claude CLI not found on PATH or common locations';
        debugLog(errMsg);
        showError(errMsg);
        throw new Error(errMsg);
    }

    const args: string[] = ['-p', prompt];
    if (skipPermissions) {
        args.push('--permission-mode', 'bypassPermissions');
    }

    debugLog(`Spawning: ${claudePath} ${args.join(' ')}`);

    return new Promise<string>((resolve, reject) => {
        const proc = spawn(claudePath, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                TERM: 'xterm-256color',
            },
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            sendClaudeOutput(chunk);
        });

        proc.stderr?.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            debugLog(`STDERR: ${chunk}`);
            const formattedError = formatTerminalOutput(chunk, 'error');
            sendToWebviewTerminal(formattedError);
        });

        proc.on('close', (code: number | null) => {
            debugLog(`Print process closed with code: ${code}`);
            if (code === 0) {
                resolve(stdout);
            } else {
                const errMsg = stderr || `Process exited with code ${code}`;
                reject(new Error(errMsg));
            }
        });

        proc.on('error', (err: Error) => {
            debugLog(`Print process error: ${err.message}`);
            reject(err);
        });
    });
}

/**
 * No-op kept for backward compatibility.
 * In print mode there is no persistent session; the caller uses runClaudePrint() directly.
 */
export async function startClaudeSession(_skipPermissions?: boolean): Promise<void> {
    debugLog('startClaudeSession: print mode - no persistent session needed');
    setSessionReady(true);
    showInfo('Claude session ready (print mode)');
}

/**
 * Reset Claude session state.
 */
export function resetClaudeSession(): void {
    debugLog('resetClaudeSession: cleaning up any lingering process');

    if (claudeProcess) {
        try {
            claudeProcess.kill();
        } catch {
            debugLog('Could not kill lingering claude process');
        }
        setClaudeProcess(null);
    }

    setSessionReady(false);
    setCurrentMessage(null);
    setProcessingQueue(false);

    updateWebviewContent();
    updateSessionState();
    showInfo('Claude session reset');
}

/**
 * Stub: keypress handling is not applicable in print mode.
 */
export function handleClaudeKeypress(_key: string): void {
    debugLog('handleClaudeKeypress: not applicable in print mode (no interactive session)');
}