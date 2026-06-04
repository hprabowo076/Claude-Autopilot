declare module 'vscode' {
    // Webview types
    export class Disposable {
        static from(...disposables: Disposable[]): Disposable;
        dispose(): void;
    }

    export interface Webview {
        postMessage(message: any): Thenable<boolean>;
        onDidReceiveMessage(listener: (e: any) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
        html: string;
        asWebviewUri(uri: Uri): Uri;
        cspSource: string;
    }

    export interface WebviewPanel {
        readonly webview: Webview;
        readonly viewType: string;
        readonly active: boolean;
        readonly visible: boolean;
        onDidChangeViewState: Event<WebviewPanelOnDidChangeViewStateEvent>;
        onDidDispose: Event<void>;
        reveal(viewColumn?: ViewColumn, preserveFocus?: boolean): void;
        dispose(): void;
        title: string;
    }

    export interface WebviewPanelOnDidChangeViewStateEvent {
        webviewPanel: WebviewPanel;
    }

    export interface Event<T> {
        (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
    }

    export enum ViewColumn {
        One = 1,
        Two = 2,
        Three = 3
    }

    export class Uri {
        static file(path: string): Uri;
        static parse(value: string): Uri;
        readonly fsPath: string;
        readonly path: string;
        readonly scheme: string;
        readonly authority: string;
        readonly query: string;
        readonly fragment: string;
    }

    export interface ExtensionContext {
        subscriptions: Disposable[];
        extensionUri: Uri;
        extensionPath: string;
        globalState: {
            get<T>(key: string, defaultValue?: T): T;
            update(key: string, value: any): Thenable<void>;
        };
        workspaceState: {
            get<T>(key: string, defaultValue?: T): T;
            update(key: string, value: any): Thenable<void>;
        };
        asAbsolutePath(relativePath: string): string;
    }

    // Configuration types
    export interface WorkspaceConfiguration {
        get<T>(section: string, defaultValue?: T): T;
        update(section: string, value: any, configurationTarget?: ConfigurationTarget): Thenable<void>;
        has(section: string): boolean;
        inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T; workspaceFolderValue?: T } | undefined;
    }

    export enum ConfigurationTarget {
        Global = 1,
        Workspace = 2,
        WorkspaceFolder = 3
    }

    // Workspace types
    export namespace workspace {
        function getConfiguration(section?: string, resource?: Uri): WorkspaceConfiguration;
        function onDidChangeConfiguration(listener: (e: ConfigurationChangeEvent) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
        function openTextDocument(options?: { content?: string; language?: string }): Thenable<TextDocument>;
        const workspaceFolders: { uri: Uri; name: string; index: number }[] | undefined;
        function findFiles(pattern: string, exclude?: string, maxResults?: number): Thenable<Uri[]>;
    }

    export interface ConfigurationChangeEvent {
        affectsConfiguration(section: string, resource?: Uri): boolean;
    }

    export interface TextDocument {
        uri: Uri;
        fileName: string;
        getText(): string;
    }

    // Window types
    export namespace window {
        function showInformationMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
        function showInformationMessage<T extends string>(message: string, options: { modal?: boolean }, ...items: T[]): Thenable<T | undefined>;
        function showWarningMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
        function showWarningMessage<T extends string>(message: string, options: { modal?: boolean }, ...items: T[]): Thenable<T | undefined>;
        function showErrorMessage<T extends string>(message: string, ...items: T[]): Thenable<T | undefined>;
        function showErrorMessage<T extends string>(message: string, options: { modal?: boolean }, ...items: T[]): Thenable<T | undefined>;
        function showInputBox(options?: { prompt?: string; placeHolder?: string; value?: string; password?: boolean; validateInput?(value: string): string | undefined }): Thenable<string | undefined>;
        function showQuickPick<T extends QuickPickItem>(items: T[] | Thenable<T[]>, options?: QuickPickOptions): Thenable<T | undefined>;
        function createWebviewPanel(viewType: string, title: string, showOptions: ViewColumn | { viewColumn: ViewColumn; preserveFocus?: boolean }, options?: { enableScripts?: boolean; localResourceRoots?: Uri[]; retainContextWhenHidden?: boolean; enableCommandUris?: boolean }): WebviewPanel;
        function withProgress<T>(options: { location: number; title: string; cancellable?: boolean }, task: (progress: { report(value: { message?: string; increment?: number }): void }) => Thenable<T>): Thenable<T>;
    }

    export interface QuickPickItem {
        label: string;
        description?: string;
        detail?: string;
    }

    export interface QuickPickOptions {
        matchOnDescription?: boolean;
        matchOnDetail?: boolean;
        placeHolder?: string;
        ignoreFocusOut?: boolean;
        canPickMany?: boolean;
    }

    export enum ProgressLocation {
        Notification = 15
    }

    // Commands
    export namespace commands {
        function registerCommand(command: string, callback: (...args: any[]) => any, thisArg?: any): Disposable;
        function executeCommand<T>(command: string, ...rest: any[]): Thenable<T | undefined>;
    }

    // Env
    export namespace env {
        function openExternal(target: Uri): Thenable<boolean>;
    }
}