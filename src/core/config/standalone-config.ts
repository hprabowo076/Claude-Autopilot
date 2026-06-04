import * as fs from 'fs';
import * as path from 'path';
import { debugLog } from '../../utils/logging';
import { ClaudeAutopilotConfig, DEFAULT_CONFIG, validateConfig } from './index';
import { EventEmitter } from 'events';

const CONFIG_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.claude-autopilot');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const configChangeEmitter = new EventEmitter();

export function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

export function loadConfigFile(): ClaudeAutopilotConfig {
    ensureConfigDir();
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
            const parsed = JSON.parse(raw) as Partial<ClaudeAutopilotConfig>;
            const config = { ...DEFAULT_CONFIG, ...parsed };
            const errors = validateConfig(config);
            if (errors.length > 0) {
                debugLog(`Standalone config validation errors: ${JSON.stringify(errors)}`);
            }
            return config;
        }
    } catch (error) {
        debugLog(`Failed to load config: ${error}`);
    }
    return { ...DEFAULT_CONFIG };
}

export function saveConfigFile(config: ClaudeAutopilotConfig): void {
    ensureConfigDir();
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        configChangeEmitter.emit('change', config);
    } catch (error) {
        debugLog(`Failed to save config: ${error}`);
    }
}

export function getConfigValue(key: string, defaultValue?: any): any {
    const config = loadConfigFile();
    const keys = key.split('.');
    let value: any = config;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return defaultValue;
        }
    }
    return value !== undefined ? value : defaultValue;
}

export function updateConfigValue(key: string, value: any, scope?: string): void {
    const config = loadConfigFile();
    const keys = key.split('.');
    let target: any = config;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in target)) {
            target[keys[i]] = {};
        }
        target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    saveConfigFile(config);
}

export function watchConfigChanges(callback: (config: ClaudeAutopilotConfig) => void): { dispose: () => void } {
    configChangeEmitter.on('change', callback);
    return {
        dispose: () => {
            configChangeEmitter.off('change', callback);
        }
    };
}

export function getConfigDir(): string {
    return CONFIG_DIR;
}