/**
 * Yahoo Finance Provider
 * API v8: https://query1.finance.yahoo.com/v8/finance/chart/
 * Remplace Finnhub pour les stocks (free tier blocking)
 */

import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();

import type {
  OHLC,
  DataProvider,
  SymbolType,
  Suggestion,
  SymbolMetadata,
  Quote,
} from "./types.js";
import { cache } from "../../cache.js";
import { getErrorMessage, logger } from "../../logger.js";

const YAHOO_BASE = "https://query1.finance.yahoo.com";
const CACHE_TTL = 300; // 5 minutes
const VIX_SYMBOL = "^VIX";
const VIX_TTL = 15 * 60; // 15 minutes (plus permissif pour indicateurs macro)

export class YahooProvider implements DataProvider {
  readonly name = "Yahoo Finance";
  readonly supportedTypes: SymbolType[] = [
    "US_STOCK" as SymbolType,
    "CANADIAN_STOCK" as SymbolType,
    "INTERNATIONAL" as SymbolType,
  ];

  // Map for single-flight protection: avoid parallel identical API calls
  private inflightRequests = new Map<string, Promise<any>>();

  /**
   * Récupère les données OHLC depuis Yahoo Finance
   * Supporte: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk, 1mo
   */
  async fetchOHLC(symbol: string, interval = "1d"): Promise<OHLC[]> {
    const key = `yahoo:ohlc:${symbol}:${interval}`;

    // Vérifier cache (mémoire → BD)
    const cached = await cache.getWithFallback<OHLC[]>(key);
    if (cached) {
      logger.debug(
        `📊 ${symbol} (${interval}): ${cached.length} candles (cache)`,
      );
      return cached;
    }

    // Single-flight: si une requête identique est déjà en cours, attendre son résultat
    if (this.inflightRequests.has(key)) {
      logger.debug(`📊 ${symbol} (${interval}): awaiting inflight request`);
      try {
        return await this.inflightRequests.get(key);
      } catch {
        // ignore and continue to refetch
      }
    }

    // Créer la promesse de fetch et la stocker pour les appels concurrents
    const fetchPromise = (async () => {
      try {
        // Yahoo nécessite un range compatible avec l'intervalle
        // Augmentation des ranges pour obtenir plus de données historiques
        const rangeMap: Record<string, string> = {
          "1m": "1d",
          "5m": "5d",
          "15m": "5d",
          "30m": "1mo",
          "1h": "3mo", // Augmenté de 1mo → 3mo
          "4h": "1y", // Augmenté de 6mo → 1y
          "1d": "5y", // Augmenté de 1y → 5y (permet ~1250 jours)
          "1wk": "10y", // Augmenté de 2y → 10y (permet ~520 semaines)
          "1mo": "20y", // Augmenté de 5y → 20y
        };

        const range = rangeMap[interval] || "5y";
        const url = `${YAHOO_BASE}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;

        logger.debug(`🔄 Fetching Yahoo data for ${symbol} (${interval})...`);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Yahoo API error: ${res.status} ${res.statusText}`);
        }

        const json = (await res.json()) as any;
        const result = json.chart?.result?.[0];

        if (!result) {
          throw new Error("No data in Yahoo response");
        }

        const timestamps = result.timestamp || [];
        const quotes = result.indicators?.quote?.[0];

        if (!quotes) {
          throw new Error("No quote data in Yahoo response");
        }

        // Filtrer les valeurs nulles et construire les OHLC
        const candles: OHLC[] = timestamps
          .map((ts: number, i: number) => ({
            date: new Date(ts * 1000).toISOString(),
            open: quotes.open[i],
            high: quotes.high[i],
            low: quotes.low[i],
            close: quotes.close[i],
            volume: quotes.volume[i] || 0,
          }))
          .filter(
            (c: OHLC) =>
              c.open !== null &&
              c.high !== null &&
              c.low !== null &&
              c.close !== null,
          );

        logger.info(
          `📊 ${symbol} (${interval}): ${candles.length} candles (API)`,
        );

        // Sauvegarder en cache (mémoire + BD)
        const ttl = symbol === VIX_SYMBOL ? VIX_TTL : CACHE_TTL;
        cache.set(key, candles, ttl);
        await cache.setDb(key, candles, "ohlc", ttl, "yahoo");

        return candles;
      } catch (error) {
        logger.error(
          `❌ Error fetching OHLC from Yahoo for ${symbol}:`,
          getErrorMessage(error),
        );
        return [] as OHLC[];
      }
    })();

    this.inflightRequests.set(key, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      // Nettoyer l'entrée inflight quelle que soit l'issue
      this.inflightRequests.delete(key);
    }
  }

  /**
   * Récupère le prix actuel depuis Yahoo Finance
   * Convertit les données Yahoo au format Bitget Quote
   */
  async fetchQuote(symbol: string): Promise<Quote> {
    // Essayer de récupérer depuis le cache d'abord (TTL 5 min pour réduire les appels API)
    const cacheKey = `quote:yahoo:${symbol}`;
    const cached = await cache.getWithFallback<Quote>(cacheKey);
    if (cached) {
      logger.debug(`📊 ${symbol} quote (cache)`);
      return cached;
    }

    // Single-flight: réutiliser une requête quote existante si présente
    if (this.inflightRequests.has(cacheKey)) {
      logger.debug(`📊 ${symbol} quote: awaiting inflight request`);
      try {
        return await this.inflightRequests.get(cacheKey);
      } catch {
        // ignore and continue
      }
    }

    // Si une requête OHLC pour le même symbole est en cours, attendre et l'utiliser
    const ohlcKey = `yahoo:ohlc:${symbol}:1d`;
    if (this.inflightRequests.has(ohlcKey)) {
      logger.debug(`📊 ${symbol} quote: awaiting inflight OHLC request`);
      try {
        const candles = await this.inflightRequests.get(ohlcKey);
        if (candles && candles.length > 0) {
          const last = candles.at(-1)!;
          const previous = candles.length > 1 ? candles.at(-2)! : last;
          const change24h = (
            (last.close - previous.close) /
            previous.close
          ).toString();
          const now = Date.now().toString();

          const quote: Quote = {
            symbol,
            name: symbol,
            open: last.open.toString(),
            high24h: last.high.toString(),
            low24h: last.low.toString(),
            lastPr: last.close.toString(),
            quoteVolume: (last.volume * last.close).toString(),
            baseVolume: last.volume.toString(),
            usdtVolume: (last.volume * last.close).toString(),
            ts: now,
            bidPr: last.close.toString(),
            askPr: last.close.toString(),
            bidSz: "0",
            askSz: "0",
            openUtc: previous.close.toString(),
            changeUtc24h: change24h,
            change24h,
          };

          const ttl = symbol === VIX_SYMBOL ? VIX_TTL : CACHE_TTL;
          await cache.setDb(cacheKey, quote, "quote", ttl, "yahoo");
          cache.set(cacheKey, quote, ttl);

          return quote;
        }
      } catch {
        // ignore and continue
      }
    }

    // Créer la promesse de quote pour les appels concurrents
    const quotePromise = (async () => {
      try {
        const candles = await this.fetchOHLC(symbol, "1d");
        if (candles.length === 0) {
          throw new Error(`No data available for ${symbol}`);
        }

        const last = candles.at(-1)!;
        const previous = candles.length > 1 ? candles.at(-2)! : last;
        const change24h = (
          (last.close - previous.close) /
          previous.close
        ).toString();
        const now = Date.now().toString();

        // Adapter les données Yahoo au format Bitget
        const quote: Quote = {
          symbol,
          name: symbol,
          open: last.open.toString(),
          high24h: last.high.toString(),
          low24h: last.low.toString(),
          lastPr: last.close.toString(),
          quoteVolume: (last.volume * last.close).toString(),
          baseVolume: last.volume.toString(),
          usdtVolume: (last.volume * last.close).toString(),
          ts: now,
          bidPr: last.close.toString(),
          askPr: last.close.toString(),
          bidSz: "0",
          askSz: "0",
          openUtc: previous.close.toString(),
          changeUtc24h: change24h,
          change24h,
        };

        // Mettre en cache pour 5 minutes
        await cache.setDb(cacheKey, quote, "quote", 300, "yahoo");
        cache.set(cacheKey, quote, 300);

        return quote;
      } catch (error) {
        logger.error(
          `❌ Error fetching quote from Yahoo for ${symbol}:`,
          getErrorMessage(error),
        );
        throw error;
      }
    })();

    this.inflightRequests.set(cacheKey, quotePromise);

    try {
      return await quotePromise;
    } finally {
      this.inflightRequests.delete(cacheKey);
    }
  }

  /**
   * Recherche de symboles via l'API Yahoo Finance Search
   * Utilise Cache générique pour limiter les appels API
   */
  async fetchSuggestions(query: string, limit = 20): Promise<Suggestion[]> {
    const normalizedQuery = query.toLowerCase();
    const cacheKey = `yahoo:suggestions:${normalizedQuery}`;

    try {
      // Vérifier cache (mémoire → BD)
      const cached = await cache.getWithFallback<Suggestion[]>(cacheKey);
      if (cached) {
        logger.debug(
          `📊 Suggestions pour "${query}": ${cached.length} résultats (cache)`,
        );
        return cached.slice(0, limit);
      }

      // 3. Appeler l'API Yahoo
      const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${limit}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      if (!res.ok) {
        throw new Error(`Yahoo search API error: ${res.status}`);
      }

      const json = (await res.json()) as any;

      if (!json.quotes) {
        throw new Error("No quotes in Yahoo search response");
      }

      const suggestions: Suggestion[] = json.quotes.map((quote: any) => {
        // Déterminer le type basé sur quoteType
        let type: SymbolType = "US_STOCK" as SymbolType;
        if (quote.exchDisp === "Toronto" || quote.exchange === "TOR") {
          type = "CANADIAN_STOCK" as SymbolType;
        } else if (
          quote.exchange &&
          !["NMS", "NYQ", "NGM", "PCX", "NAS", "NYS"].includes(quote.exchange)
        ) {
          type = "INTERNATIONAL" as SymbolType;
        }

        return {
          symbol: quote.symbol,
          name: quote.longname || quote.shortname || quote.symbol,
          type,
          exchange: quote.exchDisp || quote.exchange,
        };
      });

      // Sauvegarder en cache (mémoire 1h + BD 24h)
      const memoryTTL = CACHE_TTL * 12; // 1 heure
      const dbTTL = 24 * 60 * 60; // 24 heures

      cache.set(cacheKey, suggestions, memoryTTL);
      await cache.setDb(cacheKey, suggestions, "suggestions", dbTTL, "yahoo");

      logger.info(
        `📊 Suggestions pour "${query}": ${suggestions.length} résultats (API)`,
      );
      return suggestions;
    } catch (error) {
      logger.error(
        `❌ Error fetching suggestions from Yahoo:`,
        getErrorMessage(error),
      );
      return [];
    }
  }

  /**
   * Helper to determine SymbolType from quote data
   */
  private determineSymbolType(quote: any): SymbolType {
    if (quote.exchDisp === "Toronto" || quote.exchange === "TOR") {
      return "CANADIAN_STOCK" as SymbolType;
    }
    if (
      quote.exchange &&
      !["NMS", "NYQ", "NGM", "PCX", "NAS", "NYS"].includes(quote.exchange)
    ) {
      return "INTERNATIONAL" as SymbolType;
    }
    return "US_STOCK" as SymbolType;
  }

  /**
   * Helper to build metadata data object from quote
   */
  private buildMetadataData(quote: any): Record<string, string> {
    const data: Record<string, string> = {};

    // Informations de base
    if (quote.exchange) data.exchange = quote.exchange;
    if (quote.exchDisp) data.exchDisp = quote.exchDisp;
    if (quote.sector) data.sector = quote.sector;
    if (quote.sectorDisp) data.sectorDisp = quote.sectorDisp;
    if (quote.industry) data.industry = quote.industry;
    if (quote.industryDisp) data.industryDisp = quote.industryDisp;
    if (quote.quoteType) data.quoteType = quote.quoteType;
    if (quote.typeDisp) data.typeDisp = quote.typeDisp;
    if (quote.score !== undefined) data.score = quote.score.toString();

    // Informations sur les dividendes
    if (quote.dividendYield !== undefined) {
      data.dividendYield = quote.dividendYield.toString();
    }
    if (quote.dividendRate !== undefined) {
      data.dividendRate = quote.dividendRate.toString();
    }
    if (quote.trailingAnnualDividendYield !== undefined) {
      data.trailingAnnualDividendYield =
        quote.trailingAnnualDividendYield.toString();
    }
    if (quote.trailingAnnualDividendRate !== undefined) {
      data.trailingAnnualDividendRate =
        quote.trailingAnnualDividendRate.toString();
    }
    if (quote.exDividendDate !== undefined) {
      data.exDividendDate = new Date(quote.exDividendDate * 1000).toISOString();
    }
    if (quote.payoutRatio !== undefined) {
      data.payoutRatio = quote.payoutRatio.toString();
    }

    // Informations financières supplémentaires
    if (quote.marketCap !== undefined) {
      data.marketCap = quote.marketCap.toString();
    }
    if (quote.epsTrailingTwelveMonths !== undefined) {
      data.eps = quote.epsTrailingTwelveMonths.toString();
    }
    if (quote.epsForward !== undefined) {
      data.epsForward = quote.epsForward.toString();
    }
    if (quote.peRatio !== undefined) {
      data.peRatio = quote.peRatio.toString();
    }
    if (quote.forwardPE !== undefined) {
      data.forwardPE = quote.forwardPE.toString();
    }
    if (quote.bookValue !== undefined) {
      data.bookValue = quote.bookValue.toString();
    }
    if (quote.priceToBook !== undefined) {
      data.priceToBook = quote.priceToBook.toString();
    }

    return data;
  }

  /**
   * Récupère les métadonnées d'un symbole via l'API Yahoo Finance Search
   * 1. Table Symbol (persistant, pour symboles actifs)
   * 2. Table Cache (backup, TTL 7 jours)
   * 3. API Yahoo
   */
  async fetchMetadata(symbol: string): Promise<SymbolMetadata> {
    const cacheKey = `yahoo:metadata:${symbol}`;

    try {
      // 1. Vérifier cache (mémoire → BD) sans chercher dans Symbol table
      const cached = await cache.getWithFallback<SymbolMetadata>(cacheKey);
      if (cached) return cached;

      // 2. Utiliser yahoo-finance2 pour obtenir les données complètes
      const quoteData = await yahooFinance.quote(symbol);

      if (!quoteData) {
        throw new Error(`No metadata found for ${symbol}`);
      }

      const type = this.determineSymbolType(quoteData);
      const data = this.buildMetadataData(quoteData);

      const metadata: SymbolMetadata = {
        symbol: quoteData.symbol,
        name: quoteData.longName || quoteData.shortName || quoteData.symbol,
        type,
        data,
      };

      // Sauvegarder en cache (mémoire 5min + BD 7 jours)
      cache.set(cacheKey, metadata, CACHE_TTL);
      await cache.setDb(
        cacheKey,
        metadata,
        "metadata",
        7 * 24 * 60 * 60,
        "yahoo",
      );

      return metadata;
    } catch (error) {
      logger.error(
        `❌ Error fetching metadata from Yahoo for ${symbol}:`,
        getErrorMessage(error),
      );
      throw error;
    }
  }
}

// Export instance singleton
export const yahoo = new YahooProvider();
