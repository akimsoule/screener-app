import { analyzeSymbol } from "../levels/symbol";
import { analyzeMacroContext } from "./macroService";
import { getMarketData } from "../prices";
import { cache } from "../../lib/cache";
import { logger } from "../../lib/logger";
import { ANALYSIS_CACHE_TTL } from "../../lib/constants";
import { prisma } from "../../lib/prisma";
import type { AnalysisReport, MacroRegime, AssetClassBias } from "../types";
import type { MacroContextInput } from "./macroService";

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
    const report = await analyzeSymbol(symbol, riskConfig);

    // Mettre à jour la base de données avec les derniers résultats d'analyse
    try {
      await prisma.symbol.update({
        where: { name: symbol },
        data: {
          lastAction: report.action,
          lastScore: report.score,
          lastPrice: report.details.price,
          analyzedAt: report.timestamp ?? new Date(),
        },
      });
      logger.debug(
        `[DB] Updated symbol ${symbol} with lastAction/lastScore/lastPrice/analyzedAt`,
      );
    } catch (err) {
      logger.warn(
        `⚠️ Erreur mise à jour DB pour ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return report;
  }

  /**
   * Analyse complète avec contexte macro
   */
  async analyzeSymbolWithMacro(
    symbol: string,
    marketContext: MacroContextInput,
    options: AnalysisServiceOptions = {},
  ): Promise<EnrichedAnalysisReport> {
    const { riskConfig = {} } = options;

    // Étape 1 : Analyse macro via macroService (regime + assetBias)
    const macroAnalysis = analyzeMacroContext(marketContext);
    const macroRegime = macroAnalysis.regime;
    const assetBias = macroAnalysis.assetBias;
    // ----------------------- CACHE: AnalysisReport -----------------------
    // Construire une clé de cache stable basée sur le symbole et le régime macro
    const regimeKey = `${macroRegime.phase ?? "unknown"}:${macroRegime.cycleStage ?? "na"}:${Math.round((macroRegime.confidence ?? 0) * 100)}`;
    const cacheKey = `analysis:report:${symbol}:regime:${regimeKey}`;

    try {
      // Lecture cache (mémoire -> DB)
      const cached =
        await cache.getWithFallback<EnrichedAnalysisReport>(cacheKey);

      if (cached) {
        logger.debug(`[CACHE] Hit: ${cacheKey}`);
        // Return cached result including assetBias (cached should already include it)
        return cached;
      }
      logger.debug(`[CACHE] Miss: ${cacheKey}`);
    } catch (err) {
      // Ne pas bloquer l'analyse en cas d'erreur cache
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Échec lecture cache (${cacheKey}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // --------------------------------------------------------------------

    // Étape 3 : Analyse technique du symbole avec contexte macro
    const baseReport = await analyzeSymbol(symbol, riskConfig, macroRegime);

    const finalReport: EnrichedAnalysisReport = {
      ...baseReport,
      assetBias,
    };

    // Écrire dans le cache (mémoire + DB) pour 15 minutes
    try {
      cache.set(cacheKey, finalReport, ANALYSIS_CACHE_TTL);
      await cache.setDb(cacheKey, finalReport, "screener", ANALYSIS_CACHE_TTL);
      logger.debug(`[CACHE] Wrote: ${cacheKey}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️ Échec écriture cache (${cacheKey}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Mettre à jour la base de données avec les derniers résultats d'analyse
    try {
      await prisma.symbol.update({
        where: { name: symbol },
        data: {
          lastAction: finalReport.action,
          lastScore: finalReport.score,
          lastPrice: finalReport.details.price,
          analyzedAt: finalReport.timestamp ?? new Date(),
        },
      });
      logger.debug(
        `[DB] Updated symbol ${symbol} with lastAction/lastScore/lastPrice/analyzedAt`,
      );
    } catch (err) {
      logger.warn(
        `⚠️ Erreur mise à jour DB pour ${symbol}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return finalReport;
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
