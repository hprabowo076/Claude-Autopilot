#!/usr/bin/env node

import { program } from 'commander';
import { setWorkspaceRoot } from './core/workspace/standalone-workspace';
import { loadConfigFile } from './core/config/standalone-config';
import { loadPendingQueue, loadWorkspaceHistory } from './queue/processor/history';
import { startAutomaticMaintenance } from './queue/memory';
import { startClaudeSession } from './claude/session';
import { addMessageToQueueFromWebview } from './queue/manager';
import { getMobileServer } from './services/mobile';

import * as path from 'path';
const pkg = require(path.join(__dirname, '..', '..', 'package.json'));

async function cmdStart(options: { dir?: string; skipPermissions?: boolean }) {
    if (options.dir) setWorkspaceRoot(options.dir);

    loadConfigFile();
    loadPendingQueue();
    loadWorkspaceHistory();
    startAutomaticMaintenance();

    console.log('Starting Claude Autopilot...');
    await startClaudeSession(options.skipPermissions ?? true);

    // If there are pending messages, auto-start processing
    const { messageQueue, sessionReady, setProcessingQueue, setIsRunning } = await import('./core/state');
    const { processNextMessage } = await import('./claude/communication');

    if (messageQueue.length > 0) {
        const checkReady = setInterval(() => {
            if (sessionReady) {
                clearInterval(checkReady);
                setProcessingQueue(true);
                setIsRunning(true);
                processNextMessage();
            }
        }, 1000);
        setTimeout(() => clearInterval(checkReady), 30000);
    }
}

async function cmdAdd(message: string, options: { dir?: string }) {
    if (options.dir) setWorkspaceRoot(options.dir);
    loadConfigFile();
    loadPendingQueue();

    addMessageToQueueFromWebview(message);
    console.log(`Added message to queue: ${message.substring(0, 80)}...`);
    process.exit(0);
}

async function cmdServe(options: { dir?: string; port?: string }) {
    if (options.dir) setWorkspaceRoot(options.dir);
    loadConfigFile();
    loadPendingQueue();
    loadWorkspaceHistory();
    startAutomaticMaintenance();

    const port = options.port ? parseInt(options.port) : (process.env.PORT ? parseInt(process.env.PORT) : 8000);

    console.log(`Starting web server on port ${port}...`);
    const server = getMobileServer();
    const url = await server.start();
    console.log(`Web interface available at: ${url}`);

    // Keep running
    await new Promise(() => {});
}

async function cmdStatus(options: { dir?: string }) {
    if (options.dir) setWorkspaceRoot(options.dir);
    loadConfigFile();

    const { messageQueue, sessionReady, processingQueue } = await import('./core/state');
    console.log(`Status: ${sessionReady ? 'Session ready' : 'Session not ready'}`);
    console.log(`Processing: ${processingQueue ? 'active' : 'inactive'}`);
    console.log(`Queue: ${messageQueue.length} messages`);
    console.log(`  Pending: ${messageQueue.filter(m => m.status === 'pending').length}`);
    console.log(`  Processing: ${messageQueue.filter(m => m.status === 'processing').length}`);
    console.log(`  Completed: ${messageQueue.filter(m => m.status === 'completed').length}`);
    console.log(`  Error: ${messageQueue.filter(m => m.status === 'error').length}`);
    console.log(`  Waiting: ${messageQueue.filter(m => m.status === 'waiting').length}`);
    process.exit(0);
}

program
    .name('claude-autopilot')
    .description('Automated Claude Code task management with queue processing and auto-resume')
    .version(pkg.version);

program
    .command('start')
    .description('Start queue processing')
    .option('--dir <path>', 'Working directory')
    .option('--skip-permissions', 'Skip Claude CLI permission prompts', true)
    .action(cmdStart);

program
    .command('add <message>')
    .description('Add message to queue')
    .option('--dir <path>', 'Working directory')
    .action(cmdAdd);

program
    .command('serve')
    .description('Start web UI server')
    .option('--dir <path>', 'Working directory')
    .option('--port <number>', 'Port number')
    .action(cmdServe);

program
    .command('status')
    .description('Show queue status')
    .option('--dir <path>', 'Working directory')
    .action(cmdStatus);

program.parse(process.argv);