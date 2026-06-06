import { MessageItem } from '../../core/types';
import { messageQueue, sessionReady, processingQueue, currentMessage, setCurrentMessage, setProcessingQueue, setIsRunning, setSessionReady } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { getErrorMessage } from '../../utils/error-handler';
import { showInfo, showError } from '../../utils/notifications';
import { updateWebviewContent, updateSessionState } from '../../ui/webview';
import { saveWorkspaceHistory, ensureHistoryRun, updateMessageStatusInHistory, checkAndEndHistoryRunIfComplete } from '../../queue/processor/history';
import { runClaudePrint } from '../../claude/session';
import { getMobileServer } from '../../services/mobile/index';

export async function processNextMessage(): Promise<void> {
    debugLog('--- PROCESSING NEXT MESSAGE ---');

    if (!processingQueue) {
        debugLog('Processing stopped by user');
        updateWebviewContent();
        updateSessionState();
        return;
    }

    const message = messageQueue.find(m => m.status === 'pending');
    if (!message) {
        debugLog('No pending messages found');
        checkAndEndHistoryRunIfComplete();
        updateWebviewContent();
        updateSessionState();
        return;
    }

    debugLog(`Processing message #${message.id}: ${message.text.substring(0, 50)}...`);
    message.status = 'processing';
    message.processingStartedAt = new Date().toISOString();
    updateMessageStatusInHistory(message.id, 'processing');
    setCurrentMessage(message);
    updateWebviewContent();
    saveWorkspaceHistory();

    notifyMobile();

    try {
        const response = await runClaudePrint(message.text, true);

        debugLog(`Message #${message.id} completed, response: ${response.length} chars`);
        message.status = 'completed';
        message.completedAt = new Date().toISOString();
        message.output = response;
        updateMessageStatusInHistory(message.id, 'completed');
        updateWebviewContent();
        saveWorkspaceHistory();

        notifyMobile();

        setTimeout(() => processNextMessage(), 1000);

    } catch (error) {
        debugLog(`Error processing message #${message.id}: ${error}`);
        message.status = 'error';
        message.error = `Processing failed: ${getErrorMessage(error)}`;
        updateMessageStatusInHistory(message.id, 'error', undefined, message.error);
        updateWebviewContent();
        saveWorkspaceHistory();

        notifyMobile();

        setTimeout(() => processNextMessage(), 2000);
    }
}

function notifyMobile(): void {
    try {
        const mobileServer = getMobileServer();
        if (mobileServer.isRunning()) mobileServer.notifyQueueUpdate();
    } catch { /* silent */ }
}

export async function startProcessingQueue(skipPermissions: boolean = true): Promise<void> {
    debugLog(`startProcessingQueue called`);
    ensureHistoryRun();

    setProcessingQueue(true);
    setIsRunning(true);
    setSessionReady(true);
    updateSessionState();

    if (messageQueue.length === 0) {
        showInfo('Claude session ready (print mode). Add messages to start processing.');
        return;
    }

    processNextMessage();
}

export function stopProcessingQueue(): void {
    setProcessingQueue(false);
    setIsRunning(false);
    setCurrentMessage(null);

    checkAndEndHistoryRunIfComplete();

    updateWebviewContent();
    updateSessionState();
    showInfo('Processing stopped. Claude session remains active.');
}