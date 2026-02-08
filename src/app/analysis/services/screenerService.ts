import { prisma } from "../../../lib/prisma";
import { cache } from "../../../lib/cache";
import { logger, getErrorMessage } from "../../../lib/logger";
import { analyzeMacroContextWithRealData } from "./macroService";
import { analysisService } from "./analysisService";
import { FilterService, FilterOptions } from "./filterService";
import { fetchQuote } from "../../../lib/data/index";
import type { AnalysisReport } from "../types";
import type { Quote } from "../../../lib/data/provider/types";

// ===== HELPERS =====

/**
 * Vérifie si une valeur metadata correspond à un ensemble de valeurs possibles
 */
function matchesMetadata(
  metadata: any,
  path: string,
  expectedValues: string | string[],
): boolean {
  const parts = path.split(".");
  let value = metadata;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) return false;
  }
  const values = Array.isArray(expectedValues)
    ? expectedValues
    : [expectedValues];
  return values.includes(value);
}

/**
 * Parse une valeur numérique depuis les métadonnées
 */
function parseNumericMetadata(metadata: any, path: string): number | null {
  const parts = path.split(".");
  let value = metadata;
  for (const part of parts) {
    value = value?.[part];
    if (value === undefined) return null;
  }
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number.parseFloat(value.replaceAll(/[,%]/g, ""));
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Applique un filtre de range (min/max)
 */
function applyRangeFilter(
  value: number | null,
  min: number | undefined,
  max: number | undefined,
): boolean {
  if (value === null) return false;
  const minVal = min ?? -Infinity;
  const maxVal = max ?? Infinity;
  return value >= minVal && value <= maxVal;
}

/**
 * SERVICE SCREENER - COUCHE MÉTIER
 * Service principal d'analyse qui screene tous les symbols actifs
 * Intègre le contexte macro, les filtres dynamiques et la pagination
 */

export interface ScreenerFilters extends FilterOptions {
  // Filtres spécifiques au screener
  scoreMin?: number;
  scoreMax?: number;
  action?: string[]; // STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ScreenerResult {
  id: string;
  name: string;
  symbolType: string | null;
  provider: string | null;
  enabled: boolean;
  metadata: any;
  quote: Quote | null;
  analysis: AnalysisReport | null;
  analyzedAt: Date;
  error?: string;
}

export interface ScreenerResponse {
  data: ScreenerResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  appliedFilters: ScreenerFilters;
  macroContext: {
    regime: {
      phase: string;
      cycleStage: string;
      confidence: number;
    };
    timestamp: string;
  };
}

const SCREENER_CACHE_KEY = "screener:results";
const SCREENER_CACHE_TTL = 30 * 60; // 30 minutes
const SCREENER_SYMBOL_CACHE_PREFIX = "screener:symbol:";
const SCREENER_PROGRESS_KEY = "screener:progress";
const SCREENER_LAST_UPDATE_KEY = "screener:lastUpdate";

/**
 * Interface pour stocker le résultat d'analyse d'un symbol
 */
interface CachedSymbolResult {
  symbol: ScreenerResult;
  timestamp: string;
}

/**
 * Interface pour tracker la progression du screening
 */
interface ScreeningProgress {
  totalSymbols: number;
  analyzedSymbols: number;
  lastProcessedId: string | null;
  startedAt: string;
  updatedAt: string;
}

/**
 * Service principal du screener
 */
export class ScreenerService {
  private readonly filterService: FilterService;

  constructor() {
    this.filterService = new FilterService();
  }

  /**
   * Génère une clé de cache basée sur les filtres et la pagination
   */
  private getCacheKey(
    filters: ScreenerFilters,
    pagination: PaginationOptions,
  ): string {
    // Créer une clé unique basée sur les filtres et pagination
    const filterKey = JSON.stringify(filters);
    const paginationKey = JSON.stringify(pagination);
    return `${SCREENER_CACHE_KEY}:${Buffer.from(filterKey + paginationKey).toString("base64")}`;
  }

  /**
   * Analyse tous les symbols actifs avec filtres et pagination
   */
  async screenSymbols(
    filters: ScreenerFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<ScreenerResponse> {
    const { page = 1, limit = 10 } = pagination;
    const startTime = Date.now();

    try {
      // Vérifier le cache en mémoire d'abord
      const cacheKey = this.getCacheKey(filters, pagination);
      const cachedResult = cache.get<ScreenerResponse>(cacheKey);

      if (cachedResult) {
        logger.info("✨ Returning cached screener results");
        return cachedResult;
      }

      // Vérifier le cache DB
      const cachedDbResult = await cache.getDb<ScreenerResponse>(cacheKey);
      if (cachedDbResult) {
        logger.info("✨ Returning cached screener results (from DB)");
        // Mettre en cache mémoire aussi
        cache.set(cacheKey, cachedDbResult, SCREENER_CACHE_TTL);
        return cachedDbResult;
      }

      logger.info("🔍 Starting screener analysis (cache miss)...");

      // 1. Récupérer le contexte macro
      const macroAnalysis = await analyzeMacroContextWithRealData();
      const macroContext = {
        regime: {
          phase: macroAnalysis.regime.phase,
          cycleStage: macroAnalysis.regime.cycleStage,
          confidence: macroAnalysis.regime.confidence,
        },
        timestamp: new Date().toISOString(),
      };

      // 2. Récupérer tous les symbols actifs
      const activeSymbols = await prisma.symbol.findMany({
        where: { enabled: true },
        select: {
          id: true,
          name: true,
          symbolType: true,
          provider: true,
          enabled: true,
          metadata: true,
        },
      });

      logger.info(`📊 Found ${activeSymbols.length} active symbols to analyze`);

      // 3. Analyser chaque symbol en parallèle (avec limite pour éviter surcharge)
      const batchSize = 10;
      const results: ScreenerResult[] = [];

      for (let i = 0; i < activeSymbols.length; i += batchSize) {
        const batch = activeSymbols.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (symbol) => {
            try {
              // Analyser le symbol avec contexte macro
              const analysis = await analysisService.analyzeSymbol(
                symbol.name,
                {
                  macroContext: macroAnalysis.regime,
                },
              );

              // Récupérer la quote en temps réel
              let quote: Quote | null = null;
              try {
                quote = await fetchQuote(symbol.name, symbol.symbolType as any);
              } catch (quoteError) {
                logger.warn(
                  `⚠️ Could not fetch quote for ${symbol.name}:`,
                  getErrorMessage(quoteError),
                );
              }

              return {
                ...symbol,
                quote,
                analysis,
                analyzedAt: new Date(),
              };
            } catch (error) {
              logger.error(
                `❌ Error analyzing ${symbol.name}:`,
                getErrorMessage(error),
              );
              return {
                ...symbol,
                quote: null,
                analysis: null,
                analyzedAt: new Date(),
                error: getErrorMessage(error),
              };
            }
          }),
        );

        // Collecter les résultats
        for (const result of batchResults) {
          if (result.status === "fulfilled") {
            results.push(result.value);
          }
        }
      }

      logger.info(`✅ Analyzed ${results.length} symbols`);

      // 4. Appliquer les filtres
      const filteredResults = this.applyFilters(results, filters);

      logger.info(
        `🔍 After filters: ${filteredResults.length} symbols remaining`,
      );

      // 5. Pagination
      const total = filteredResults.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = filteredResults.slice(startIndex, endIndex);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`⏱️ Screener analysis completed in ${duration}s`);

      const response: ScreenerResponse = {
        data: paginatedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        appliedFilters: filters,
        macroContext,
      };

      // Mettre en cache les résultats
      cache.set(cacheKey, response, SCREENER_CACHE_TTL);
      await cache.setDb(
        cacheKey,
        response,
        "screener",
        SCREENER_CACHE_TTL,
        "screener",
      );

      logger.info(`💾 Results cached for ${SCREENER_CACHE_TTL / 60} minutes`);

      return response;
    } catch (error) {
      logger.error("❌ Screener error:", getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Applique les filtres sur les résultats
   */
  private applyFilters(
    results: ScreenerResult[],
    filters: ScreenerFilters,
  ): ScreenerResult[] {
    let filtered = results;

    // Filtre par score
    if (filters.scoreMin !== undefined) {
      filtered = filtered.filter(
        (r) => r.analysis && r.analysis.score >= filters.scoreMin!,
      );
    }
    if (filters.scoreMax !== undefined) {
      filtered = filtered.filter(
        (r) => r.analysis && r.analysis.score <= filters.scoreMax!,
      );
    }

    // Filtre par action recommandée
    if (filters.action && filters.action.length > 0) {
      const actionsLower = filters.action.map((a) => a.toLowerCase());
      filtered = filtered.filter((r) => {
        if (!r.analysis) return false;
        const action = r.analysis.action.toLowerCase();
        // Gérer les emojis (🟢 STRONG_BUY, etc.)
        return actionsLower.some((a) => action.includes(a.replace("_", " ")));
      });
    }

    // Filtres metadata (via FilterService)
    // Appliquer en JavaScript car déjà en mémoire
    if (filters.symbolType) {
      const types = Array.isArray(filters.symbolType)
        ? filters.symbolType
        : [filters.symbolType];
      filtered = filtered.filter(
        (r) => r.symbolType && types.includes(r.symbolType),
      );
    }

    if (filters.sector) {
      filtered = filtered.filter((r) =>
        matchesMetadata(r.metadata, "data.sector", filters.sector!),
      );
    }

    if (filters.industry) {
      filtered = filtered.filter((r) =>
        matchesMetadata(r.metadata, "data.industry", filters.industry!),
      );
    }

    if (filters.exchange) {
      filtered = filtered.filter((r) =>
        matchesMetadata(r.metadata, "data.exchange", filters.exchange!),
      );
    }

    if (filters.quoteCurrency) {
      filtered = filtered.filter((r) =>
        matchesMetadata(
          r.metadata,
          "data.quoteCurrency",
          filters.quoteCurrency!,
        ),
      );
    }

    // Filtres numériques
    if (
      filters.dividendYieldMin !== undefined ||
      filters.dividendYieldMax !== undefined
    ) {
      filtered = filtered.filter((r) =>
        applyRangeFilter(
          parseNumericMetadata(r.metadata, "data.dividendYield"),
          filters.dividendYieldMin,
          filters.dividendYieldMax,
        ),
      );
    }

    if (filters.peRatioMin !== undefined || filters.peRatioMax !== undefined) {
      filtered = filtered.filter((r) =>
        applyRangeFilter(
          parseNumericMetadata(r.metadata, "data.peRatio"),
          filters.peRatioMin,
          filters.peRatioMax,
        ),
      );
    }

    if (
      filters.marketCapMin !== undefined ||
      filters.marketCapMax !== undefined
    ) {
      filtered = filtered.filter((r) =>
        applyRangeFilter(
          parseNumericMetadata(r.metadata, "data.marketCap"),
          filters.marketCapMin,
          filters.marketCapMax,
        ),
      );
    }

    return filtered;
  }

  /**
   * Récupère les filtres disponibles basés sur les symbols actifs
   */
  async getAvailableFilters() {
    return this.filterService.getAvailableFilters();
  }

  /**
   * Met à jour le screening de manière incrémentale
   * Conçu pour être exécuté dans un serverless avec limite de temps (10s)
   * @param maxSymbols Nombre max de symboles à traiter (défaut: 20)
   * @param forceRestart Force le redémarrage du screening depuis le début
   */
  async updateScreening(
    maxSymbols = 20,
    forceRestart = false,
  ): Promise<{
    processed: number;
    remaining: number;
    progress: number;
    isComplete: boolean;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      // Récupérer ou initialiser la progression
      let progress = await cache.getDb<ScreeningProgress>(
        SCREENER_PROGRESS_KEY,
      );

      if (forceRestart || !progress) {
        // Récupérer le nombre total de symboles actifs
        const totalSymbols = await prisma.symbol.count({
          where: { enabled: true },
        });

        progress = {
          totalSymbols,
          analyzedSymbols: 0,
          lastProcessedId: null,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        logger.info(
          `🔄 Starting new screening cycle for ${totalSymbols} symbols`,
        );
      }

      // Récupérer le contexte macro (une seule fois pour tout le batch)
      const macroAnalysis = await analyzeMacroContextWithRealData();

      // Récupérer le prochain batch de symboles
      const symbolsToProcess = await prisma.symbol.findMany({
        where: {
          enabled: true,
          ...(progress.lastProcessedId && {
            id: { gt: progress.lastProcessedId },
          }),
        },
        select: {
          id: true,
          name: true,
          symbolType: true,
          provider: true,
          enabled: true,
          metadata: true,
        },
        orderBy: { id: "asc" },
        take: maxSymbols,
      });

      logger.info(
        `📊 Processing ${symbolsToProcess.length} symbols (${progress.analyzedSymbols}/${progress.totalSymbols} done)`,
      );

      // Analyser chaque symbol
      let processed = 0;
      for (const symbol of symbolsToProcess) {
        try {
          // Analyser le symbol avec contexte macro
          const analysis = await analysisService.analyzeSymbol(symbol.name, {
            macroContext: macroAnalysis.regime,
          });

          // Récupérer la quote en temps réel
          let quote: Quote | null = null;
          try {
            quote = await fetchQuote(symbol.name, symbol.symbolType as any);
          } catch (quoteError) {
            logger.warn(
              `⚠️ Could not fetch quote for ${symbol.name}:`,
              getErrorMessage(quoteError),
            );
          }

          const result: ScreenerResult = {
            ...symbol,
            quote,
            analysis,
            analyzedAt: new Date(),
          };

          // Stocker le résultat dans le cache (individuel)
          const cacheKey = `${SCREENER_SYMBOL_CACHE_PREFIX}${symbol.id}`;
          const cachedResult: CachedSymbolResult = {
            symbol: result,
            timestamp: new Date().toISOString(),
          };

          // Cache mémoire + DB
          cache.set(cacheKey, cachedResult, SCREENER_CACHE_TTL);
          await cache.setDb(
            cacheKey,
            cachedResult,
            "screener",
            SCREENER_CACHE_TTL,
          );

          processed++;
          progress.lastProcessedId = symbol.id;
          progress.analyzedSymbols++;
        } catch (error) {
          logger.error(
            `❌ Error analyzing ${symbol.name}:`,
            getErrorMessage(error),
          );
          // Continuer même en cas d'erreur
        }
      }

      // Mettre à jour la progression
      progress.updatedAt = new Date().toISOString();
      await cache.setDb(
        SCREENER_PROGRESS_KEY,
        progress,
        "screener",
        SCREENER_CACHE_TTL,
      );

      // Vérifier si terminé
      const isComplete = progress.analyzedSymbols >= progress.totalSymbols;

      if (isComplete) {
        // Enregistrer le timestamp de dernière mise à jour complète
        await cache.setDb(
          SCREENER_LAST_UPDATE_KEY,
          { timestamp: new Date().toISOString() },
          "screener",
          SCREENER_CACHE_TTL,
        );

        logger.info("✅ Screening cycle completed!");

        // Réinitialiser la progression pour le prochain cycle
        await cache.setDb(
          SCREENER_PROGRESS_KEY,
          null,
          "screener",
          SCREENER_CACHE_TTL,
        );
      }

      const duration = Date.now() - startTime;
      const progressPercent =
        (progress.analyzedSymbols / progress.totalSymbols) * 100;

      logger.info(
        `⏱️ Processed ${processed} symbols in ${duration}ms (${progressPercent.toFixed(1)}% complete)`,
      );

      return {
        processed,
        remaining: progress.totalSymbols - progress.analyzedSymbols,
        progress: progressPercent,
        isComplete,
        duration,
      };
    } catch (error) {
      logger.error("❌ Update screening error:", getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Récupère les résultats du screening depuis le cache avec filtres et pagination
   * Méthode rapide qui ne fait pas d'analyse, uniquement de la récupération
   */
  async getScreening(
    filters: ScreenerFilters = {},
    pagination: PaginationOptions = {},
  ): Promise<ScreenerResponse> {
    const { page = 1, limit = 10 } = pagination;
    const startTime = Date.now();

    try {
      logger.info("🔍 Retrieving screening results from cache...");

      // Récupérer tous les symbols actifs pour obtenir leurs IDs
      const activeSymbols = await prisma.symbol.findMany({
        where: { enabled: true },
        select: { id: true },
      });

      logger.info(
        `📊 Found ${activeSymbols.length} active symbols in database`,
      );

      // Récupérer les résultats d'analyse depuis le cache
      const results: ScreenerResult[] = [];

      for (const symbol of activeSymbols) {
        const cacheKey = `${SCREENER_SYMBOL_CACHE_PREFIX}${symbol.id}`;

        // Essayer cache mémoire d'abord
        let cachedResult = cache.get<CachedSymbolResult>(cacheKey);

        // Sinon cache DB
        if (!cachedResult) {
          cachedResult = await cache.getDb<CachedSymbolResult>(cacheKey);
          if (cachedResult) {
            // Repeupler le cache mémoire
            cache.set(cacheKey, cachedResult, SCREENER_CACHE_TTL);
          }
        }

        if (cachedResult) {
          results.push(cachedResult.symbol);
        }
      }

      logger.info(`✅ Retrieved ${results.length} cached results`);

      // Récupérer le contexte macro actuel
      const macroAnalysis = await analyzeMacroContextWithRealData();
      const macroContext = {
        regime: {
          phase: macroAnalysis.regime.phase,
          cycleStage: macroAnalysis.regime.cycleStage,
          confidence: macroAnalysis.regime.confidence,
        },
        timestamp: new Date().toISOString(),
      };

      // Appliquer les filtres
      const filteredResults = this.applyFilters(results, filters);

      logger.info(
        `🔍 After filters: ${filteredResults.length} symbols remaining`,
      );

      // Pagination
      const total = filteredResults.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = filteredResults.slice(startIndex, endIndex);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`⏱️ Screening retrieval completed in ${duration}s`);

      return {
        data: paginatedResults,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        appliedFilters: filters,
        macroContext,
      };
    } catch (error) {
      logger.error("❌ Get screening error:", getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Récupère l'état de la progression du screening
   */
  async getScreeningProgress(): Promise<ScreeningProgress | null> {
    return cache.getDb<ScreeningProgress>(SCREENER_PROGRESS_KEY);
  }

  /**
   * Récupère le timestamp de la dernière mise à jour complète
   */
  async getLastUpdateTimestamp(): Promise<string | null> {
    const result = await cache.getDb<{ timestamp: string }>(
      SCREENER_LAST_UPDATE_KEY,
    );
    return result?.timestamp || null;
  }
}

// Export singleton
export const screenerService = new ScreenerService();
