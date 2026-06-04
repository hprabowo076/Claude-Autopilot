import { debugMode } from '../../core/state';

export function debugLog(message: string): void {
    if (debugMode) {
        const formattedMessage = formatTerminalOutput(message, 'debug');
        console.log(formattedMessage);
    }
}

export function formatTerminalOutput(text: string, type: 'claude' | 'debug' | 'error' | 'info' | 'success'): string {
    const now = new Date();
    const timestamp = `${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    switch (type) {
        case 'claude':
            return `\n🤖 [CLAUDE ${timestamp}]\n${text}\n>>> [END CLAUDE OUTPUT]\n`;
        case 'debug':
            return `[DEBUG ${timestamp}] ${text}`;
        case 'error':
            return `❌ [ERROR ${timestamp}] ${text}`;
        case 'info':
            return `ℹ️  [INFO ${timestamp}] ${text}`;
        case 'success':
            return `✅ [SUCCESS ${timestamp}] ${text}`;
        default:
            return `[${timestamp}] ${text}`;
    }
}

export function sendToWebviewTerminal(output: string): void {
    // No-op in standalone — terminal output goes to stdout
}

export function getWorkspacePath(): string {
    const { getWorkspaceRoot } = require('../core/workspace/standalone-workspace');
    return getWorkspaceRoot() || process.cwd();
}

export function getHistoryStorageKey(): string {
    return `claudeautopilot_history_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function getPendingQueueStorageKey(): string {
    return `claudeautopilot_pending_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}