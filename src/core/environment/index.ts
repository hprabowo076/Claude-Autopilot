import { getConfigValue } from '../config/standalone-config';

export function isDevelopmentMode(): boolean {
    const devMode = getConfigValue('developmentMode', false);
    const isDebugBuild = process.env.NODE_ENV === 'development' ||
                        process.env.DEBUG_MODE === 'true';

    return devMode || isDebugBuild;
}

export function withDevelopmentMode<T>(developmentFn: () => T, productionFn?: () => T): T | undefined {
    if (isDevelopmentMode()) {
        return developmentFn();
    } else if (productionFn) {
        return productionFn();
    }
    return undefined;
}

export function developmentOnly(fn: () => void): void {
    if (isDevelopmentMode()) {
        fn();
    }
}