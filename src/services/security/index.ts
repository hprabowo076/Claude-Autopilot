import { claudePanel } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { getValidatedConfig, updateConfigValue } from '../../core/config';
import { showWarning } from '../../utils/notifications';

export function sendSecuritySettings(): void {
    const config = getValidatedConfig();

    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'setSecuritySettings',
                allowDangerousXssbypass: config.security.allowDangerousXssbypass
            });

            if (config.security.allowDangerousXssbypass) {
                showWarning('⚠️ SECURITY WARNING: XSS bypass is enabled!');
            }
        } catch (error) {
            debugLog(`❌ Failed to send security settings to webview: ${error}`);
        }
    }
}

export function toggleXssbypassSetting(enabled: boolean): void {
    updateConfigValue('security.allowDangerousXssbypass', enabled);
    debugLog(`🔒 XSS bypass setting updated: ${enabled}`);
    sendSecuritySettings();
}