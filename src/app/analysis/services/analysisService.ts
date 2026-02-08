import { analyzeSymbol } from "../levels/symbol";
import { detectMacroRegime } from "../levels/levelMacro";
import { calculateAssetClassBias } from "../levels/levelAssetClass";
import { getMarketData } from "../prices";
import type { AnalysisReport, MacroRegime, AssetClassBias } from "../types";

/**
 * SERVICE D'ANALYSE - COUCHE MÉTIER
 * Service qui orchestre les différents niveaux d'analyse
 * Séparation claire entre la logique métier (service) et les scripts/UI
 *
 * Ce service sera consommé par :
 * - scripts/runAnalysis.ts (mode console)
 * - future application REST
 */

export interface AnalysisServiceOptions {
  riskConfig?: any;
  macroContext?: MacroRegime;
}

export interface EnrichedAnalysisReport extends AnalysisReport {
  assetBias?: AssetClassBias;
}

/**
 * Service d'analyse unifié
 */
export class AnalysisService {
  /**
   * Analyse un symbole individuel (niveau symbole uniquement)
   */
  async analyzeSymbol(
    symbol: string,
    options: AnalysisServiceOptions = {},
  ): Promise<AnalysisReport> {
    const { riskConfig = {} } = options;
    return analyzeSymbol(symbol, riskConfig);
  }

  /**
   * Analyse complète avec contexte macro
   */
  async analyzeSymbolWithMacro(
    symbol: string,
    marketContext: Parameters<typeof detectMacroRegime>[0],
    options: AnalysisServiceOptions = {},
  ): Promise<EnrichedAnalysisReport> {
    const { riskConfig = {} } = options;

    // Étape 1 : Détection du régime macro
    const macroRegime = detectMacroRegime(marketContext);

    // Étape 2 : Calcul des biais sectoriels
    const assetBias = calculateAssetClassBias(macroRegime);

    // Étape 3 : Analyse technique du symbole avec contexte macro
    const baseReport = await analyzeSymbol(symbol, riskConfig, macroRegime);

    return {
      ...baseReport,
      assetBias,
    };
  }

  /**
   * Analyse multiple de symboles en parallèle
   * Optimisation : récupère VIX une seule fois pour tous les symboles
   */
  async analyzeBatch(
    symbols: string[],
    options: AnalysisServiceOptions = {},
  ): Promise<
    Array<{ symbol: string; result?: AnalysisReport; error?: string }>
  > {
    // Récupérer VIX une seule fois pour tout le batch
    const vixData = await getMarketData("^VIX");
    const vixValue: number =
      (vixData &&
      typeof vixData === "object" &&
      "price" in vixData &&
      typeof vixData.price === "number"
        ? vixData.price
        : 0) || 0;

    // Injecter VIX dans la config de risque pour éviter les appels répétés
    const enhancedOptions = {
      ...options,
      riskConfig: {
        ...options.riskConfig,
        vixValue, // Passer la valeur VIX pré-calculée
      },
    };

    const results = await Promise.allSettled(
      symbols.map((symbol) => this.analyzeSymbol(symbol, enhancedOptions)),
    );

    return results.map((res, idx) => {
      if (res.status === "fulfilled") {
        return { symbol: symbols[idx], result: res.value };
      } else {
        return {
          symbol: symbols[idx],
          error: res.reason?.message || String(res.reason),
        };
      }
    });
  }
}

// Export singleton
export const analysisService = new AnalysisService();
