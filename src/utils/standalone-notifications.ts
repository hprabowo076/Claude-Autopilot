import { getErrorMessage } from './error-handler';

export interface NotificationOptions {
    modal?: boolean;
    items?: string[];
}

export interface ErrorNotificationOptions extends NotificationOptions {
    showDetails?: boolean;
}

export function showInfo(message: string, options?: NotificationOptions): Promise<string | undefined> {
    console.log(`ℹ️  ${message}`);
    return Promise.resolve(undefined);
}

export function showWarning(message: string, options?: NotificationOptions): Promise<string | undefined> {
    console.warn(`⚠️  ${message}`);
    return Promise.resolve(undefined);
}

export function showError(message: string, options?: ErrorNotificationOptions): Promise<string | undefined> {
    console.error(`❌ ${message}`);
    return Promise.resolve(undefined);
}

export function showErrorFromException(error: unknown, context?: string, options?: ErrorNotificationOptions): Promise<string | undefined> {
    const errorMessage = getErrorMessage(error);
    const fullMessage = context ? `${context}: ${errorMessage}` : errorMessage;
    return showError(fullMessage, options);
}

export function showInput(options: {
    prompt: string;
    placeholder?: string;
    value?: string;
    password?: boolean;
    validateInput?: (value: string) => string | undefined;
}): Promise<string | undefined> {
    // Interactive input — fallback to prompt
    if (process.stdin.isTTY) {
        return new Promise((resolve) => {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(`${options.prompt} `, (answer: string) => {
                rl.close();
                resolve(answer || undefined);
            });
        });
    }
    console.log(`${options.prompt} (no TTY available)`);
    return Promise.resolve(undefined);
}

export const Messages = {
    SESSION_ALREADY_RUNNING: 'Claude session is already running',
    SESSION_STARTED: 'Claude session started successfully',
    SESSION_STOPPED: 'Claude session stopped',
    MESSAGE_ADDED: 'Message added to Claude queue',
    ALL_MESSAGES_PROCESSED: 'All messages processed. Claude session remains active.',
    QUEUE_CLEARED: 'Message queue cleared',
    WEB_INTERFACE_NOT_RUNNING: 'Web interface is not running. Please start it first.',
    WEB_INTERFACE_STARTED: (url: string) => `Web interface started! Visit: ${url}`,
    WEB_INTERFACE_STOPPED: 'Web interface stopped',
    FAILED_TO_START_PROCESSING: 'Failed to start processing',
    FAILED_TO_START_SESSION: 'Failed to start Claude session',
    FAILED_TO_START_WEB_INTERFACE: 'Failed to start web interface',
    FAILED_TO_STOP_WEB_INTERFACE: 'Failed to stop web interface',
    FAILED_TO_SHOW_QR: 'Failed to show QR code',
    FAILED_TO_OPEN_WEB_INTERFACE: 'Failed to open web interface',
    FAILED_TO_OPEN_SETTINGS: 'Failed to open settings',
    FAILED_AUTO_START_SESSION: 'Failed to auto-start Claude session'
} as const;