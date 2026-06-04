#!/usr/bin/env node

import { getMobileServer } from './src/services/mobile';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8000;

async function main() {
    console.log('Starting Claude Autopilot Web Server...');
    console.log(`Port: ${PORT}`);

    const server = getMobileServer();
    const url = await server.start();
    console.log(`Server started at: ${url}`);
    console.log('Press Ctrl+C to stop');

    const shutdown = async () => {
        console.log('\nShutting down...');
        await server.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

if (require.main === module) {
    main().catch((error) => {
        console.error('Failed to start:', error);
        process.exit(1);
    });
}