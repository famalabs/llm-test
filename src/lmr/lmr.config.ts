import { LmrConfig } from "./interfaces";

const DEFAULT_CONFIG = {
    baseConfig: {
        parallel: false,
    },
}

export const resolveConfig = (lmrConfig: Partial<LmrConfig>): LmrConfig => {
    if (!lmrConfig.baseConfig) throw new Error("baseConfig is required in LmrConfig");

    return {
        baseConfig: {
            ...DEFAULT_CONFIG.baseConfig,
            ...lmrConfig.baseConfig
        },
    };
}