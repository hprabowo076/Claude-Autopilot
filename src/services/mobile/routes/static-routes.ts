import { Application, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { AuthManager, AuthConfig } from '../auth/';
import {
    INDEX_HTML,
    PASSWORD_HTML,
    MANIFEST_JSON,
    STYLES_CSS,
    JS_APP_JS,
    JS_CONSTANTS_JS,
    JS_CORE_MOBILEINTERFACE_JS,
    JS_EXPLORER_FILEEXPLORER_JS,
    JS_GIT_GITCHANGES_JS,
    JS_UTILS_ANSI_JS,
    JS_UTILS_HTML_JS,
    JS_UTILS_SYNTAX_JS,
    JS_UTILS_TIME_JS,
} from './embedded-webview';

const EMBEDDED_FILES: Record<string, string> = {
    'index.html': INDEX_HTML,
    'password.html': PASSWORD_HTML,
    'manifest.json': MANIFEST_JSON,
    'styles.css': STYLES_CSS,
    'js/app.js': JS_APP_JS,
    'js/constants.js': JS_CONSTANTS_JS,
    'js/core/MobileInterface.js': JS_CORE_MOBILEINTERFACE_JS,
    'js/explorer/FileExplorer.js': JS_EXPLORER_FILEEXPLORER_JS,
    'js/git/GitChanges.js': JS_GIT_GITCHANGES_JS,
    'js/utils/ansi.js': JS_UTILS_ANSI_JS,
    'js/utils/html.js': JS_UTILS_HTML_JS,
    'js/utils/syntax.js': JS_UTILS_SYNTAX_JS,
    'js/utils/time.js': JS_UTILS_TIME_JS,
};

function getEmbeddedFile(requestedPath: string): string | undefined {
    return EMBEDDED_FILES[requestedPath];
}

function isEmbeddedFile(requestedPath: string): boolean {
    return requestedPath in EMBEDDED_FILES;
}

/**
 * Extract auth token from request, trying multiple sources:
 * 1. query param `token`
 * 2. `x-auth-token` header
 * 3. `Authorization: Bearer` header
 * 4. `authToken` cookie
 */
function extractToken(req: Request): string | undefined {
    return (
        (req.query.token as string) ||
        (req.headers['x-auth-token'] as string) ||
        req.headers.authorization?.replace('Bearer ', '') ||
        (req as any).cookies?.authToken
    );
}

export class StaticRoutes {
    private authManager: AuthManager;
    private config: AuthConfig;

    constructor(authManager: AuthManager, config: AuthConfig) {
        this.authManager = authManager;
        this.config = config;
    }

    public updateConfig(config: AuthConfig): void {
        this.config = config;
        this.authManager.updateConfig(config);
    }

    public setupRoutes(app: Application): void {
        app.get('/', (req: Request, res: Response) => {
            // Accept token from query param, header, Authorization Bearer, or cookie
            const token = extractToken(req);
            if (token !== this.config.authToken) {
                // If the request has no token at all, redirect to include the token
                // This handles the case where user opens the bare URL in a browser
                if (!token) {
                    return res.redirect(`/?token=${this.config.authToken}`);
                }
                return res.status(401).json({ error: 'Unauthorized: Invalid or missing authentication token' });
            }

            // Set auth token as a cookie so subsequent subresource requests work without query params
            res.cookie('authToken', this.config.authToken, {
                httpOnly: false,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });

            if (this.config.useExternalServer && this.config.webPassword) {
                const sessionToken = (req as any).cookies?.sessionToken;
                if (!sessionToken || !this.authManager.hasActiveSession(sessionToken)) {
                    return res.redirect(`/password?token=${this.config.authToken}`);
                }
            }

            let html = INDEX_HTML;

            html = html.replace('href="styles.css"', `href="styles.css?token=${this.config.authToken}"`);
            html = html.replace('src="js/app.js"', `src="js/app.js?token=${this.config.authToken}"`);
            html = html.replace('href="manifest.json"', `href="manifest.json?token=${this.config.authToken}"`);

            html = html.replace('</head>', `
                <script>
                    window.CLAUDE_AUTH_TOKEN = '${this.config.authToken}';
                </script>
                </head>
            `);

            res.send(html);
        });

        app.get('/password', (req: Request, res: Response) => {
            const token = extractToken(req);
            if (token !== this.config.authToken) {
                return res.status(401).json({ error: 'Unauthorized: Invalid or missing authentication token' });
            }

            res.send(PASSWORD_HTML);
        });

        app.get('/manifest.json', (req: Request, res: Response) => {
            if (extractToken(req) !== this.config.authToken) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!this.authManager.checkPasswordForStaticFiles(req, res)) {
                return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.send(MANIFEST_JSON);
        });


        app.get('/styles.css', (req: Request, res: Response) => {
            if (extractToken(req) !== this.config.authToken) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!this.authManager.checkPasswordForStaticFiles(req, res)) {
                return;
            }

            res.setHeader('Content-Type', 'text/css');
            res.send(STYLES_CSS);
        });


        // Serve modular JavaScript files from /js/ directory
        app.get(/\/js\/.*/, (req: Request, res: Response) => {
            const token = extractToken(req);
            const referer = (req.headers.referer || req.headers.referrer) as string;
            
            // Allow ES6 module imports if:
            // 1. They have a direct token, OR
            // 2. They come from an authenticated page (Referer with token), OR  
            // 3. They come from the same origin (for module import chains)
            const hasDirectToken = token === this.config.authToken;
            const fromAuthenticatedPage = referer && referer.includes(`token=${this.config.authToken}`);
            const fromSameOrigin = referer && (
                referer.startsWith(`http://${req.headers.host}`) || 
                referer.startsWith(`https://${req.headers.host}`) ||
                (req.headers.host && referer.includes(req.headers.host as string))
            );
            
            if (!hasDirectToken && !fromAuthenticatedPage && !fromSameOrigin) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            if (!this.authManager.checkPasswordForStaticFiles(req, res)) {
                return;
            }
            
            // Extract the file path from the URL
            const requestedPath = req.path.replace(/^\//, '');
            
            const embeddedContent = getEmbeddedFile(requestedPath);
            if (embeddedContent === undefined) {
                console.error(`JS file not embedded: ${requestedPath}`);
                return res.status(404).send(`JS file not found: ${requestedPath}`);
            }
            
            res.setHeader('Content-Type', 'application/javascript');
            res.send(embeddedContent);
        });
    }
}
