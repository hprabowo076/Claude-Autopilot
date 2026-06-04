import * as fs from 'fs';
import * as path from 'path';
import { claudePanel, messageQueue, debugMode, sessionReady, processingQueue } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { getValidatedConfig } from '../../core/config';

export function updateWebviewContent(): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'updateQueue',
                queue: messageQueue
            });
        } catch (error) {
            debugLog(`Failed to update webview content: ${error}`);
        }
    }
}

export function updateSessionState(): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'sessionStateChanged',
                isSessionRunning: sessionReady,
                isProcessing: processingQueue
            });
        } catch (error) {
            debugLog(`Failed to update session state: ${error}`);
        }
    }
}

export function getWebviewContent(context: any, webview?: any): string {
    // In standalone mode, return minimal HTML fallback
    return `<!DOCTYPE html>
<html><head><title>Claude Autopilot</title>
<style>body{font-family:sans-serif;padding:20px;background:#1e1e1e;color:#ccc}</style>
</head><body><h1>Claude Autopilot</h1><p>Web UI mode: Run 'claude-autopilot serve'</p></body></html>`;
}

export function sendHistoryVisibilitySettings(): void {
    const config = getValidatedConfig();
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'setHistoryVisibility',
                showInUI: config.history.showInUI
            });
        } catch (error) {
            debugLog(`Failed to send history visibility settings: ${error}`);
        }
    }
}