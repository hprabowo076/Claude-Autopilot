import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';
import { EventEmitter } from 'events';

const workspaceChangeEmitter = new EventEmitter();
let _workspaceRoot: string = process.cwd();

export function getWorkspaceRoot(): string | null {
    return _workspaceRoot;
}

export function setWorkspaceRoot(dir: string): void {
    _workspaceRoot = path.resolve(dir);
    if (!fs.existsSync(_workspaceRoot)) {
        fs.mkdirSync(_workspaceRoot, { recursive: true });
    }
    workspaceChangeEmitter.emit('change', _workspaceRoot);
}

export function getWorkspaceFolders(): { uri: { fsPath: string }; name: string }[] | undefined {
    try {
        const name = path.basename(_workspaceRoot);
        return [{ uri: { fsPath: _workspaceRoot }, name }];
    } catch {
        return undefined;
    }
}

export function asRelativePath(uri: { fsPath: string } | string): string {
    const p = typeof uri === 'string' ? uri : uri.fsPath;
    return path.relative(_workspaceRoot, p).replace(/\\/g, '/');
}

export function findFiles(pattern: string, excludePattern?: string, maxResults?: number): Promise<{ fsPath: string }[]> {
    return new Promise((resolve, reject) => {
        const ignore: string[] = [];
        if (excludePattern) {
            const parts = excludePattern.replace(/[{}]/g, '').split(',');
            for (const p of parts) {
                ignore.push(p.trim());
            }
        }
        glob(pattern, { cwd: _workspaceRoot, nodir: true, absolute: true, ignore }).then((matches: string[]) => {
            let result = matches.map(m => ({ fsPath: m }));
            if (maxResults && result.length > maxResults) {
                result = result.slice(0, maxResults);
            }
            resolve(result);
        }).catch(reject);
    });
}

export function onDidChangeConfiguration(callback: (event: { affectsConfiguration: (section: string) => boolean }) => void): { dispose: () => void } {
    return { dispose: () => {} };
}

export { workspaceChangeEmitter };