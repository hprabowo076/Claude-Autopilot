import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir } from '../config/standalone-config';

interface StandaloneGlobalState {
    [key: string]: any;
}

let stateCache: StandaloneGlobalState = {};
let statePath: string;
let loaded = false;

function ensureStateFile(): void {
    if (loaded) return;
    const configDir = getConfigDir();
    statePath = path.join(configDir, 'state.json');
    loaded = true;
}

function readState(): StandaloneGlobalState {
    ensureStateFile();
    if (Object.keys(stateCache).length > 0) return stateCache;
    try {
        if (fs.existsSync(statePath)) {
            const raw = fs.readFileSync(statePath, 'utf8');
            stateCache = JSON.parse(raw);
        }
    } catch (error) {
        stateCache = {};
    }
    return stateCache;
}

function writeState(): void {
    ensureStateFile();
    try {
        if (!fs.existsSync(path.dirname(statePath))) {
            fs.mkdirSync(path.dirname(statePath), { recursive: true });
        }
        fs.writeFileSync(statePath, JSON.stringify(stateCache, null, 2), 'utf8');
    } catch (error) {
        // silently fail
    }
}

export class StandaloneStateManager {
    globalState = {
        get<T>(key: string, defaultValue?: T): T {
            const state = readState();
            return key in state ? state[key] as T : defaultValue as T;
        },

        update(key: string, value: any): void {
            const state = readState();
            state[key] = value;
            stateCache = state;
            writeState();
        },

        keys(): string[] {
            return Object.keys(readState());
        }
    };
}

export function createStandaloneState(): StandaloneStateManager {
    return new StandaloneStateManager();
}

export const standaloneState = new StandaloneStateManager();