/**
 * Main dependency checking orchestration
 */
import { DependencyCheckResults } from './types';
import {
    checkClaudeInstallation,
    checkPythonInstallation,
    checkPtyWrapperAvailability,
    checkNgrokInstallation
} from './checkers';
import * as os from 'os';
import { showError } from '../../utils/notifications';
import { getConfigValue, updateConfigValue } from '../../core/config';

function getPythonInstallInstructions(): string {
    const platform = os.platform();
    
    switch (platform) {
        case 'darwin': // macOS
            return `Python Installation (macOS):
1. Install via Homebrew: brew install python3
2. Or download from: https://python.org/downloads
3. Restart VS Code
4. Verify installation: python3 --version`;
            
        case 'win32': // Windows  
            return `Python Installation (Windows):
1. Download from: https://python.org/downloads
2. During installation, check "Add Python to PATH"
3. Restart VS Code
4. Verify installation: python --version`;
            
        case 'linux': // Linux
            return `Python Installation (Linux):
1. Ubuntu/Debian: sudo apt update && sudo apt install python3
2. CentOS/RHEL: sudo yum install python3
3. Restart VS Code
4. Verify installation: python3 --version`;
            
        default:
            return `Python Installation:
1. Visit: https://python.org/downloads
2. Download Python 3.9 or higher
3. Follow platform-specific installation instructions
4. Restart VS Code
5. Verify installation: python3 --version`;
    }
}

// Re-export status functions
export { showDependencyStatus, showInstallationInstructions } from './status';

// Debounce validation to prevent multiple simultaneous checks
let validationTimeout: NodeJS.Timeout | undefined;

export async function runDependencyCheck(): Promise<DependencyCheckResults> {
    // Check if external server (ngrok) is enabled
    const useExternalServer = getConfigValue('webInterface.useExternalServer', false);

    // Run core checks concurrently
    const [claude, pythonResult, wrapper] = await Promise.all([
        checkClaudeInstallation(),
        checkPythonInstallation().catch(error => ({
            available: false,
            error: error.message,
            installInstructions: getPythonInstallInstructions()
        })),
        checkPtyWrapperAvailability()
    ]);
    
    const python = pythonResult;

    let ngrok;
    if (useExternalServer) {
        // Only check ngrok if external server is enabled
        ngrok = await checkNgrokInstallation();
        
        // If ngrok is not available but external server is enabled, disable external server
        if (!ngrok.available) {
            await handleNgrokUnavailable();
        }
    } else {
        // Mock successful ngrok check when external server is disabled
        ngrok = {
            available: true,
            version: 'Not required (external server disabled)',
            path: 'n/a'
        };
    }

    return {
        claude,
        python,
        wrapper,
        ngrok
    };
}

/**
 * Check ngrok availability when external server setting is enabled
 * Called when user enables external server through settings
 */
export async function validateExternalServerSetting(): Promise<boolean> {
    // Clear any existing validation timeout to debounce rapid changes
    if (validationTimeout) {
        clearTimeout(validationTimeout);
    }
    
    // Debounce rapid configuration changes
    return new Promise((resolve) => {
        validationTimeout = setTimeout(async () => {
            try {
                const result = await performValidation();
                resolve(result);
            } catch (error) {
                console.error('Validation error:', error);
                resolve(false);
            }
        }, 200);
    });
}

async function performValidation(): Promise<boolean> {
    console.log('🔍 Starting external server validation...');

    const useExternalServer = getConfigValue('webInterface.useExternalServer', false);

    console.log('  - Should validate:', useExternalServer);

    if (!useExternalServer) {
        console.log('  - Skipping validation (setting is false)');
        return true;
    }

    // Show checking message
    console.log('  - Starting ngrok check...');
    const ngrokResult = await checkNgrokInstallation();
    console.log('  - Ngrok check result:', ngrokResult.available, ngrokResult.version || ngrokResult.error);

    if (!ngrokResult.available) {
        console.log('  - Ngrok not available, calling handleNgrokUnavailable');
        await handleNgrokUnavailable();
        return false;
    } else {
        console.log(`✅ External server enabled successfully. ${ngrokResult.version} is ready.`);
        return true;
    }
}

/**
 * Handle the case when ngrok is not available but external server is enabled
 */
async function handleNgrokUnavailable(): Promise<void> {
    try {
        updateConfigValue('webInterface.useExternalServer', false);
        showError("ngrok is required for external server but not available. External server has been disabled.");
    } catch (error) {
        console.error('Failed to disable external server setting:', error);
    }
}