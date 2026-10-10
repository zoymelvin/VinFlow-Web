"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GLOBAL_CONFIG = void 0;
exports.GLOBAL_CONFIG = {
    insightDisplayLimit: 3,
    staleInsightDecay: 0.2,
    thresholds: {
        cashFlowWarningRatio: 0.75,
        cashFlowCriticalRatio: 0.95,
        significantCategoryShare: 0.35,
        unusualExpenseMultiplier: 2.5,
        lowDataThreshold: 5,
        recurringExpenseRatio: 0.15,
        projectionWarningDays: 5,
    },
};
