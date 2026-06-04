import { debugLog } from '../../utils/logging';
import { debugMode } from '../state';
import { saveConfigFile, loadConfigFile } from './standalone-config';
export { getConfigValue, updateConfigValue } from './standalone-config';

export interface ClaudeAutopilotConfig {
    // Development settings
    developmentMode: boolean;
    
    // Queue management settings
    queue: {
        maxSize: number;
        maxMessageSize: number;
        maxOutputSize: number;
        maxErrorSize: number;
        cleanupThreshold: number;
        retentionHours: number;
    };
    
    // Session settings
    session: {
        autoStart: boolean;
        skipPermissions: boolean;
        scheduledStartTime: string; // Format: "HH:MM" or empty string for disabled
    };
    
    // Sleep prevention settings
    sleepPrevention: {
        enabled: boolean;
        method: 'caffeinate' | 'powershell' | 'systemd-inhibit' | 'auto';
    };
    
    // History settings
    history: {
        maxRuns: number;
        autoSave: boolean;
        persistPendingQueue: boolean;
        showInUI: boolean;
    };
    
    // Security settings
    security: {
        allowDangerousXssbypass: boolean;
    };
}

export const DEFAULT_CONFIG: ClaudeAutopilotConfig = {
    developmentMode: false,
    
    queue: {
        maxSize: 1000,
        maxMessageSize: 50000,
        maxOutputSize: 100000,
        maxErrorSize: 10000,
        cleanupThreshold: 500,
        retentionHours: 24
    },
    
    session: {
        autoStart: false,
        skipPermissions: true,
        scheduledStartTime: ''
    },
    
    sleepPrevention: {
        enabled: true,
        method: 'auto'
    },
    
    history: {
        maxRuns: 20,
        autoSave: true,
        persistPendingQueue: true,
        showInUI: false
    },
    
    security: {
        allowDangerousXssbypass: false
    }
};

export interface ConfigValidationError {
    path: string;
    value: any;
    expected: string;
    message: string;
}

export function validateConfig(config: Partial<ClaudeAutopilotConfig>): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    
    // Helper function to add validation errors
    const addError = (path: string, value: any, expected: string, message: string) => {
        errors.push({ path, value, expected, message });
    };
    
    // Validate development mode
    if (config.developmentMode !== undefined && typeof config.developmentMode !== 'boolean') {
        addError('developmentMode', config.developmentMode, 'boolean', 'Development mode must be true or false');
    }
    
    
    // Validate queue settings
    if (config.queue) {
        const q = config.queue;
        
        if (q.maxSize !== undefined) {
            if (typeof q.maxSize !== 'number' || q.maxSize < 10 || q.maxSize > 10000) {
                addError('queue.maxSize', q.maxSize, 'number (10-10000)', 'Must be a number between 10 and 10000');
            }
        }
        
        if (q.maxMessageSize !== undefined) {
            if (typeof q.maxMessageSize !== 'number' || q.maxMessageSize < 1000 || q.maxMessageSize > 1000000) {
                addError('queue.maxMessageSize', q.maxMessageSize, 'number (1000-1000000)', 'Must be a number between 1KB and 1MB');
            }
        }
        
        if (q.retentionHours !== undefined) {
            if (typeof q.retentionHours !== 'number' || q.retentionHours < 1 || q.retentionHours > 168) {
                addError('queue.retentionHours', q.retentionHours, 'number (1-168)', 'Must be a number between 1 and 168 hours (1 week)');
            }
        }
    }
    
    // Validate session settings
    if (config.session) {
        const s = config.session;
        
        if (s.autoStart !== undefined && typeof s.autoStart !== 'boolean') {
            addError('session.autoStart', s.autoStart, 'boolean', 'Auto start must be true or false');
        }
        
        if (s.skipPermissions !== undefined && typeof s.skipPermissions !== 'boolean') {
            addError('session.skipPermissions', s.skipPermissions, 'boolean', 'Skip permissions must be true or false');
        }
        
        if (s.scheduledStartTime !== undefined) {
            if (typeof s.scheduledStartTime !== 'string') {
                addError('session.scheduledStartTime', s.scheduledStartTime, 'string', 'Scheduled start time must be a string');
            } else if (s.scheduledStartTime !== '' && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(s.scheduledStartTime)) {
                addError('session.scheduledStartTime', s.scheduledStartTime, 'HH:MM format', 'Scheduled start time must be in HH:MM format (e.g., "09:30") or empty string to disable');
            }
        }
        
        // Check for conflicting settings
        if (s.autoStart === true && s.scheduledStartTime !== undefined && s.scheduledStartTime !== '') {
            addError('session.autoStart + session.scheduledStartTime', 'both enabled', 'only one enabled', 'Cannot use both autoStart and scheduledStartTime - choose one or the other');
        }
    }
    
    // Validate sleep prevention settings
    if (config.sleepPrevention) {
        const sp = config.sleepPrevention;
        
        if (sp.enabled !== undefined && typeof sp.enabled !== 'boolean') {
            addError('sleepPrevention.enabled', sp.enabled, 'boolean', 'Sleep prevention enabled must be true or false');
        }
        
        if (sp.method !== undefined) {
            const validMethods = ['caffeinate', 'powershell', 'systemd-inhibit', 'auto'];
            if (!validMethods.includes(sp.method)) {
                addError('sleepPrevention.method', sp.method, validMethods.join(' | '), 'Must be one of the supported methods');
            }
        }
    }
    
    // Validate history settings
    if (config.history) {
        const h = config.history;
        
        if (h.maxRuns !== undefined) {
            if (typeof h.maxRuns !== 'number' || h.maxRuns < 1 || h.maxRuns > 100) {
                addError('history.maxRuns', h.maxRuns, 'number (1-100)', 'Must be a number between 1 and 100');
            }
        }
        
        if (h.autoSave !== undefined && typeof h.autoSave !== 'boolean') {
            addError('history.autoSave', h.autoSave, 'boolean', 'Auto save must be true or false');
        }
        
        if (h.persistPendingQueue !== undefined && typeof h.persistPendingQueue !== 'boolean') {
            addError('history.persistPendingQueue', h.persistPendingQueue, 'boolean', 'Persist pending queue must be true or false');
        }
        
        if (h.showInUI !== undefined && typeof h.showInUI !== 'boolean') {
            addError('history.showInUI', h.showInUI, 'boolean', 'Show in UI must be true or false');
        }
    }
    
    // Validate security settings
    if (config.security) {
        const sec = config.security;
        
        if (sec.allowDangerousXssbypass !== undefined && typeof sec.allowDangerousXssbypass !== 'boolean') {
            addError('security.allowDangerousXssbypass', sec.allowDangerousXssbypass, 'boolean', 'Allow dangerous XSS bypass must be true or false');
        }
    }
    
    return errors;
}

export function getValidatedConfig(): ClaudeAutopilotConfig {
    try {
        const config = loadConfigFile();
        const errors = validateConfig(config);

        if (errors.length > 0) {
            debugLog('⚠️ Configuration validation errors found:');
            errors.forEach(error => {
                debugLog(`  - ${error.path}: ${error.message} (got: ${error.value}, expected: ${error.expected})`);
            });
            return getDefaultsForInvalidConfig(config, errors);
        }

        return config;
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function getDefaultsForInvalidConfig(config: ClaudeAutopilotConfig, errors: ConfigValidationError[]): ClaudeAutopilotConfig {
    const fixedConfig = { ...config };
    
    // Reset invalid values to defaults
    errors.forEach(error => {
        const pathParts = error.path.split('.');
        let defaultValue = DEFAULT_CONFIG;
        let targetObject = fixedConfig;
        
        // Navigate to the correct nested object
        for (let i = 0; i < pathParts.length - 1; i++) {
            defaultValue = (defaultValue as any)[pathParts[i]];
            targetObject = (targetObject as any)[pathParts[i]];
        }
        
        // Set the default value
        const finalKey = pathParts[pathParts.length - 1];
        (targetObject as any)[finalKey] = (defaultValue as any)[finalKey];
    });
    
    return fixedConfig;
}

export function resetConfigToDefaults(): void {
    saveConfigFile({ ...DEFAULT_CONFIG });
    debugLog('🔄 Configuration reset to defaults');
}

export function showConfigValidationStatus(): void {
    const config = getValidatedConfig();
    if (debugMode) {
        debugLog('✅ Configuration valid');
    }
}

// Configuration change listener
export function watchConfigChanges(callback: (config: ClaudeAutopilotConfig) => void): { dispose: () => void } {
    const { watchConfigChanges: watchStandalone } = require('./standalone-config');
    return watchStandalone(callback);
}