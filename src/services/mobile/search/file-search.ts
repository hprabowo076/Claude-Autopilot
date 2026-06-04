/**
 * Workspace file search functionality for mobile interface
 */
import * as path from 'path';
import { getWorkspaceRoot, findFiles, asRelativePath } from '../../../core/workspace/standalone-workspace';

export interface FileSearchResult {
    path: string;
    name: string;
}

export interface FileSearchResponse {
    files: FileSearchResult[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export class FileSearchService {
    /**
     * Search workspace files using VSCode's built-in search
     */
    public async searchWorkspaceFiles(query: string, page: number = 1, pageSize: number = 50): Promise<FileSearchResponse> {
        try {
            const excludePattern = '{**/node_modules/**,**/dist/**,**/build/**,**/out/**,**/.git/**,**/coverage/**,**/.nyc_output/**,**/logs/**,**/tmp/**,**/temp/**}';

            let files: { fsPath: string }[];
            if (query && query.trim()) {
                const [queryFiles, queryDirs] = await Promise.all([
                    findFiles(`**/*${query}*`, excludePattern, 500),
                    findFiles(`**/*${query}*/**`, excludePattern, 500)
                ]);
                files = [...queryFiles, ...queryDirs];
            } else {
                files = await findFiles('**/*', excludePattern, 1000);
            }

            let results = files.map(file => ({
                path: asRelativePath(file),
                name: path.basename(file.fsPath)
            }))
            .filter((file, index, self) => index === self.findIndex(f => f.path === file.path))
            .sort((a, b) => {
                // Sort by relevance: exact matches first, then by name length, then alphabetically
                if (query) {
                    const aExact = a.name.toLowerCase() === query.toLowerCase();
                    const bExact = b.name.toLowerCase() === query.toLowerCase();
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    
                    const aIncludes = a.name.toLowerCase().includes(query.toLowerCase());
                    const bIncludes = b.name.toLowerCase().includes(query.toLowerCase());
                    if (aIncludes && !bIncludes) return -1;
                    if (!aIncludes && bIncludes) return 1;
                }
                return a.path.localeCompare(b.path);
            });

            // Implement pagination
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedFiles = results.slice(startIndex, endIndex);

            return {
                files: paginatedFiles,
                total: results.length,
                page,
                pageSize,
                totalPages: Math.ceil(results.length / pageSize)
            };
        } catch (error) {
            throw new Error(`Failed to search workspace files: ${error}`);
        }
    }
}

// Singleton instance
let fileSearchInstance: FileSearchService | null = null;

export function getFileSearchService(): FileSearchService {
    if (!fileSearchInstance) {
        fileSearchInstance = new FileSearchService();
    }
    return fileSearchInstance;
}
