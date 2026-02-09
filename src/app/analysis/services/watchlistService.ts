import { prisma } from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { filterService, FilterOptions } from "./filterService";
import type { AnalysisReport } from "../types";
import { logger } from "../../lib/logger";

export interface WatchlistItem {
  id: string;
  name: string;
  symbolType?: string | null;
  provider?: string | null;
  metadata?: any;
  lastAction?: string | null;
  lastScore?: number | null;
  lastPrice?: number | null;
  enabled: boolean;
  analysis?: AnalysisReport | null;
  cacheKey?: string | null;
}

export interface WatchlistResult {
  data: WatchlistItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  appliedFilters: Partial<FilterOptions>;
}

export class WatchlistService {
  private readonly DEFAULT_LIMIT = 10;

  /**
   * Retourne la watchlist paginée en tenant compte des filtres.
   * Récupère les rapports d'analyse depuis le cache (analysis:report:${symbol}:regime:...)
   */
  async getWatchlist(
    options: FilterOptions = {},
    page = 1,
    limit = this.DEFAULT_LIMIT,
  ): Promise<WatchlistResult> {
    // Récupérer les symboles filtrés (méthode de FilterService)
    const filteredSymbols = await filterService.filterSymbols(options);

    const total = filteredSymbols.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const start = (page - 1) * limit;
    const pageSymbols = filteredSymbols.slice(start, start + limit);

    const data: WatchlistItem[] = [];

    for (const s of pageSymbols) {
      let analysis: AnalysisReport | null = null;
      let cacheKey: string | null = null;

      try {
        // Rechercher la dernière entrée de cache pour ce symbole (par préfixe)
        const prefix = `analysis:report:${s.name}:regime:`;
        const cached = await prisma.cache.findFirst({
          where: { key: { startsWith: prefix }, expiresAt: { gt: new Date() } },
          orderBy: { updatedAt: "desc" },
        });

        if (cached?.value) {
          // Prisma returns Json - convert safely to AnalysisReport
          analysis = cached.value as unknown as AnalysisReport;
          cacheKey = cached.key;
        }
      } catch (err) {
        logger.warn(
          `⚠️ Erreur lecture cache analysis pour ${s.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      data.push({
        id: s.id,
        name: s.name,
        symbolType: s.symbolType,
        provider: s.provider,
        metadata: s.metadata,
        lastAction: s.lastAction,
        lastScore: s.lastScore,
        lastPrice: s.lastPrice,
        enabled: s.enabled,
        analysis,
        cacheKey,
      });
    }

    return {
      data,
      pagination: { page, limit, total, totalPages },
      appliedFilters: options,
    };
  }
}

export const watchlistService = new WatchlistService();
