/**
 * INDEX PRINCIPAL DU PACKAGE ANALYSIS
 * Exporte les fonctionnalités d'analyse organisées par niveau de responsabilité
 */

// =============== NIVEAUX D'ANALYSE ===============

// Niveau Macro - Analyse du régime macro-économique
export { detectMacroRegime } from "./levels/levelMacro";

// Niveau Asset Class - Biais sectoriels basés sur le régime macro
export { calculateAssetClassBias } from "./levels/levelAssetClass";

// Niveau Symbole - Analyse technique complète d'un symbole
export { analyzeSymbol } from "./levels/symbol";
export type { SymbolMetadata } from "./types";

// =============== SERVICES MÉTIER ===============

// Service d'analyse - Logique métier pour l'orchestration des analyses
export { AnalysisService, analysisService } from "./services/analysisService";
export type {
  AnalysisServiceOptions,
  EnrichedAnalysisReport,
} from "./services/analysisService";

// Service de données - Routing vers les providers (Bitget, Yahoo)
export { DataService, dataService } from "./services/dataService";

// Service macro - Logique métier spécialisée pour l'analyse macro
export {
  analyzeMacroContext,
  analyzeMacroContextWithRealData,
  isMacroFavorableFor,
} from "./services/macroService";
export type {
  MacroContextInput,
  MacroAnalysisResult,
} from "./services/macroService";

// =============== UTILITAIRES ===============

// Récupération de données de marché
export { getPrices, getMarketData, detectSymbolType } from "./prices";

// =============== TYPES ===============

export type {
  OHLC,
  Regime,
  TradeSide,
  VolatilityRegime,
  RiskConfig,
  TradeRecommendation,
  MacroRegime,
  AssetClassBias,
  RiskAssessment,
  AnalysisReport,
  PortfolioConfig,
  PortfolioRecommendation,
} from "./types";

// =============== CONSTANTES ===============

export {
  SCORE_THRESHOLDS,
  SCORE_NORMALIZATION,
  INDICATOR_PERIODS,
  REGIME_THRESHOLDS,
  RISK_DEFAULTS,
  TRADE_PARAMS,
  SCORE_WEIGHTS,
  RSI_LEVELS,
  LIOT_BIAS,
  ASSET_PATTERNS,
  DATA_REQUIREMENTS,
  HOLDING_PERIODS,
} from "./constants";
