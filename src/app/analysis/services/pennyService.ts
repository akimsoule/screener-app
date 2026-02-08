import { prisma } from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { logger, getErrorMessage } from "../../lib/logger";
import {
  fetchMetadata,
  fetchQuote,
  fetchSymbolsFromDummyScreener,
} from "../../lib/data/index";
import type { Quote, SymbolMetadata } from "../../lib/data/provider/types";
import { SymbolType } from "../../lib/data/provider/types";
import pLimit from "p-limit";
import { Prisma } from "@prisma/client";

const PENNY_CACHE_KEY = "penny:results";
const PENNY_CACHE_TTL = 15 * 60; // 15 minutes

export interface PennyResult {
  ticker: string;
  price?: number;
  rVol?: number;
  dailyDollarVolume?: number;
  sector?: string;
  passedFilters: boolean;
  analyzedAt: string;
}

export class PennyScannerService {
  /**
   * Run a penny scan (dummy provider only)
   */
  public async scan(): Promise<PennyResult[]> {
    const start = Date.now();

    try {
      // Get candidate symbols (dummy provider)
      const symbols = await fetchSymbolsFromDummyScreener();
      logger.info(
        `📊 Found ${symbols.length} candidate symbols for penny scan (source=dummy)`,
      );

      const limit = pLimit(5);
      const promises = symbols.map((ticker) =>
        limit(async () => {
          const result: PennyResult = {
            ticker,
            passedFilters: false,
            analyzedAt: new Date().toISOString(),
          };

          try {
            // Metadata
            let metadata: SymbolMetadata | null = null;
            try {
              metadata = await fetchMetadata(ticker, SymbolType.CANADIAN_STOCK);
            } catch (err: unknown) {
              logger.debug(
                `⚠️ Error fetching metadata for ${ticker}: ${getErrorMessage(err)}`,
              );
            }

            // Quote
            let quote: Quote | null = null;
            try {
              quote = await fetchQuote(ticker, SymbolType.CANADIAN_STOCK);
            } catch (err: unknown) {
              logger.debug(
                `⚠️ Error fetching quote for ${ticker}: ${getErrorMessage(err)}`,
              );
            }

            let price: number | undefined = undefined;
            let currentVolume = 0;
            let averageVolume30d = 0;

            if (quote) {
              price = Number.parseFloat(quote.lastPr) || undefined;
              currentVolume = Number.parseFloat(quote.baseVolume) || 0;
              averageVolume30d =
                currentVolume > 0 ? Math.max(1, currentVolume / 2) : 0;
            }

            const rVol =
              averageVolume30d > 0
                ? currentVolume / averageVolume30d
                : undefined;
            const dailyDollarVolume =
              price === undefined ? undefined : currentVolume * price;

            // Static filters
            let passed = true;
            if (!ticker.endsWith(".TO") && !ticker.endsWith(".V"))
              passed = false;
            if (price === undefined || price < 0.05 || price > 0.5)
              passed = false;

            const marketCap = metadata?.data?.marketCap
              ? Number.parseFloat(metadata.data.marketCap)
              : undefined;
            if (marketCap !== undefined && marketCap >= 100000000)
              passed = false;
            if (dailyDollarVolume !== undefined && dailyDollarVolume < 50000)
              passed = false;
            if (rVol !== undefined && rVol <= 2) passed = false;

            const bid = quote ? Number.parseFloat(quote.bidPr) || 0 : 0;
            const ask = quote ? Number.parseFloat(quote.askPr) || 0 : 0;
            const spread = bid === 0 ? 1 : (ask - bid) / bid;
            if (spread >= 0.05) passed = false;

            result.price = price;
            result.rVol = rVol;
            result.dailyDollarVolume = dailyDollarVolume;
            result.sector = metadata?.data?.sector;
            result.passedFilters = passed;

            // Persist candidate
            try {
              const provider = "dummy";
              const metaToSave: Record<string, unknown> = {
                discoveredBy: "pennyScanner",
                discoveredAt: new Date().toISOString(),
              };
              if (metadata) metaToSave.sourceMetadata = metadata;
              if (result.rVol !== undefined) metaToSave.rVol = result.rVol;
              if (result.price !== undefined)
                metaToSave.lastPrice = result.price;

              await prisma.symbol.upsert({
                where: { name: ticker },
                create: {
                  name: ticker,
                  enabled: false,
                  isPopular: false,
                  symbolType: "CANADIAN_STOCK",
                  provider,
                  metadata: metaToSave as Prisma.InputJsonValue,
                  lastPrice: result.price,
                  analyzedAt: new Date(),
                },
                update: {
                  provider,
                  symbolType: "CANADIAN_STOCK",
                  metadata: metaToSave as Prisma.InputJsonValue,
                  lastPrice: result.price,
                  analyzedAt: new Date(),
                },
              });
            } catch (err: unknown) {
              logger.error(
                `❌ Error saving symbol ${ticker} to DB:`,
                getErrorMessage(err),
              );
            }
          } catch (err: unknown) {
            logger.error(`❌ Error analyzing ${ticker}:`, getErrorMessage(err));
          }

          return result;
        }),
      );

      const results = await Promise.all(promises);

      // Cache results (only the ones that passed filters)
      const passedResults = results.filter((r) => r.passedFilters);
      cache.set(PENNY_CACHE_KEY, passedResults, PENNY_CACHE_TTL);
      await cache.setDb(
        PENNY_CACHE_KEY,
        passedResults,
        "screener",
        PENNY_CACHE_TTL,
        "pennyScanner",
      );

      const duration = ((Date.now() - start) / 1000).toFixed(2);
      logger.info(
        `⏱️ Penny scan completed in ${duration}s - found ${passedResults.length} passing items`,
      );

      return passedResults;
    } catch (error) {
      logger.error("❌ Penny scan failed:", getErrorMessage(error));
      throw error;
    }
  }

  public async getCachedResults(): Promise<PennyResult[] | null> {
    // Use cache.getWithFallback to consult memory then DB
    const result = await cache.getWithFallback<PennyResult[]>(PENNY_CACHE_KEY);
    return result;
  }
}

export const pennyService = new PennyScannerService();
