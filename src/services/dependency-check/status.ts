/**
 * Dependency status display and reporting
 */
import { DependencyCheckResults, DependencyStatus } from './types';
import { DebugEmojis } from '../../core/constants/ui-strings';
import { showInfo, showError, showErrorFromException } from '../../utils/notifications';

export function showDependencyStatus(results: DependencyCheckResults): void {
    const status = analyzeDependencyStatus(results);

    if (status.allReady) {
        showInfo(status.successMessages[0]);
    } else {
        const errorSummary = status.issues.join('\n');
        showError(`Missing dependencies detected:\n\n${errorSummary}`);
    }
}

export function showInstallationInstructions(results: DependencyCheckResults): void {
    const { claude, python, wrapper, ngrok } = results;

    let instructions = '=== Claude Autopilot - Dependency Status ===\n\n';

    if (claude.available) {
        instructions += `✅ Claude Code: ${claude.version}\n\n`;
    } else {
        instructions += `❌ Claude Code: Missing\n${claude.installInstructions}\n\n`;
    }

    if (python.available) {
        instructions += `✅ Python: ${python.version}\n\n`;
    } else {
        instructions += `❌ Python: Missing\n${python.installInstructions}\n\n`;
    }

    if (wrapper.available) {
        instructions += `✅ PTY Wrapper: Ready\n\n`;
    } else {
        instructions += `❌ PTY Wrapper: ${wrapper.error}\n${wrapper.installInstructions}\n\n`;
    }

    if (ngrok.available) {
        instructions += `✅ ngrok: ${ngrok.version}\n\n`;
    } else {
        instructions += `⚠️ ngrok: Missing (optional)\n${ngrok.installInstructions}\n\n`;
    }

    console.log(instructions);
}

function analyzeDependencyStatus(results: DependencyCheckResults): DependencyStatus {
    const { claude, python, wrapper, ngrok } = results;
    const issues: string[] = [];
    const successMessages: string[] = [];
    
    // Check critical dependencies
    let allCriticalReady = true;
    
    if (!claude.available) {
        issues.push(`${DebugEmojis.ERROR} Claude Code: ${claude.error}`);
        allCriticalReady = false;
    }
    
    if (!python.available) {
        issues.push(`${DebugEmojis.ERROR} Python: ${python.error}`);
        allCriticalReady = false;
    }
    
    if (!wrapper.available) {
        issues.push(`${DebugEmojis.ERROR} PTY Wrapper: ${wrapper.error}`);
        allCriticalReady = false;
    }
    
    // ngrok is optional, don't fail if missing
    if (!ngrok.available) {
        issues.push(`${DebugEmojis.WARNING} ngrok: ${ngrok.error} (optional - web interface won't work)`);
    }
    
    if (allCriticalReady) {
        successMessages.push(
            `${DebugEmojis.SUCCESS} All dependencies ready! Claude: ${claude.version}, Python: ${python.version}, ngrok: ${ngrok.version || 'not available'}`
        );
    }
    
    return {
        allReady: allCriticalReady,
        issues,
        successMessages
    };
}

// Import here to avoid circular dependency
async function runDependencyCheck(): Promise<DependencyCheckResults> {
    const { runDependencyCheck: runCheck } = await import('./index');
    return runCheck();
}