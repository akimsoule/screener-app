/**
 * 📦 SYMBOL ANALYSIS PACKAGE
 *
 * Architecture modulaire pour l'analyse des symboles :
 *
 * - utils.ts : Helpers génériques (score normalization, VIX, etc.)
 * - regime.ts : Détection de régime (STRONG_TREND, WEAK_TREND, RANGE, CHOP)
 * - timing.ts : Analyse hourly pour timing optimal (support/resistance)
 * - scoring.ts : Calcul score technique + LIOT macro bias
 * - risk.ts : Évaluation risque (VIX, volatilité, fraîcheur données, etc.)
 * - recommendation.ts : Construction des recommandations de trade
 * - analyzer.ts : Fonction principale analyzeSymbol (orchestration)
 *
 * Utilisation :
 * ```typescript
 * import { analyzeSymbol } from "./levels/symbol";
 *
 * const report = await analyzeSymbol("AAPL", { accountSize: 100000 }, macroRegime);
 * console.log(report.score, report.action, report.recommendation);
 * ```
 */

export { analyzeSymbol } from "./analyzer";
export type { SymbolMetadata } from "../../types";

// Exports optionnels pour usage avancé
export {
  normalizeScore,
  scoreToAction,
  interpretScore,
  DEFAULT_RISK_CONFIG,
} from "./utils";
export { detectRegime } from "./regime";
export { analyzeHourlyTiming } from "./timing";
export { assessRisk } from "./risk";
export { buildRecommendation } from "./recommendation";
export {
  computeTechnicalScore,
  calculateLiotBias,
  getAssetClass,
  type AssetClass,
} from "./scoring";
