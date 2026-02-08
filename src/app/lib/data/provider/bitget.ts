/**
 * Bitget API Provider
 * Documentation: https://www.bitget.com/api-doc/spot/market/Get-Candle-Data
 */

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
import { prisma } from "../../prisma.js";

const BITGET_BASE = "https://api.bitget.com/api/v2/spot/market";
const CACHE_TTL = {
  OHLC: 300, // 5 minutes
  QUOTE: 60, // 1 minute
};

export class BitgetProvider implements DataProvider {
  readonly name = "Bitget";
  readonly supportedTypes: SymbolType[] = ["CRYPTO" as SymbolType];

  /**
   * Normalise le symbole pour Bitget
   * Accepte: BTCUSDT, BTC-USD, ETHUSDT, ETH-USD
   * Supprime les nombres des symboles (ex: TAO22974-USD → TAOUSDT)
   * Retourne: BTCUSDT, ETHUSDT (format Bitget)
   */
  public normalizeSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();

    // Si déjà au format Bitget (BTCUSDT, ETHUSDT), retourner tel quel
    if (/^[A-Z0-9]+(USDT|USDC|BUSD)$/i.test(upper)) {
      return upper;
    }

    // Supprimer les nombres du symbole de base
    const cleanSymbol = upper.replace(/\d+/g, "");

    // Convertir BTC-USD → BTCUSDT, ETH-EUR → ETHEUR
    return cleanSymbol.replaceAll("-", "").replace(/USD$/, "USDT");
  }

  /**
   * Convertit l'intervalle vers le format Bitget
   * 1d → 1day
   * 1wk → 1week
   */
  private convertInterval(interval: string): string {
    const map: Record<string, string> = {
      "1d": "1day",
      "1wk": "1week",
      "1h": "1h",
      "4h": "4h",
    };
    return map[interval] || "1day";
  }

  /**
   * Récupère les données OHLC depuis Bitget
   */
  async fetchOHLC(symbol: string, interval = "1d"): Promise<OHLC[]> {
    const bitgetSymbol = this.normalizeSymbol(symbol);
    const bitgetInterval = this.convertInterval(interval);
    const key = `bitget:ohlc:${bitgetSymbol}:${bitgetInterval}`;

    // Vérifier cache (mémoire → BD)
    const cached = await cache.getWithFallback<OHLC[]>(key);
    if (cached) {
      logger.debug(
        `📊 ${symbol} (${interval}): ${cached.length} candles (cache)`,
      );
      return cached;
    }

    try {
      // Bitget limite à 1000 candles max
      const limit = 1000;
      const url = `${BITGET_BASE}/candles?symbol=${bitgetSymbol}&granularity=${bitgetInterval}&limit=${limit}`;

      logger.debug(
        `🔄 Fetching Bitget data for ${symbol} (${bitgetSymbol})...`,
      );

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Bitget API error: ${res.status} ${res.statusText}`);
      }

      const json = (await res.json()) as any;

      if (json.code !== "00000") {
        throw new Error(`Bitget API error: ${json.msg || "Unknown error"}`);
      }

      const data = json.data || [];
      logger.info(`📊 ${symbol} raw data received: ${data.length} candles`);

      // Format Bitget: [timestamp, open, high, low, close, volume, volumeUsd]
      const candles: OHLC[] = data.map((item: any) => ({
        date: new Date(Number.parseInt(item[0])).toISOString(),
        open: Number.parseFloat(item[1]),
        high: Number.parseFloat(item[2]),
        low: Number.parseFloat(item[3]),
        close: Number.parseFloat(item[4]),
        volume: Number.parseFloat(item[5]),
      }));

      logger.info(
        `📊 ${symbol} (${interval}): ${candles.length} candles (API)`,
      );

      // Sauvegarder en cache (mémoire + BD)
      cache.set(key, candles, CACHE_TTL.OHLC);
      await cache.setDb(key, candles, "ohlc", CACHE_TTL.OHLC, "bitget");

      return candles;
    } catch (error) {
      logger.error(
        `❌ Error fetching OHLC from Bitget for ${symbol}:`,
        getErrorMessage(error),
      );
      return cached ?? [];
    }
  }

  /**
   * Récupère le prix actuel depuis Bitget
   */
  async fetchQuote(symbol: string): Promise<Quote> {
    const bitgetSymbol = this.normalizeSymbol(symbol);
    const key = `bitget:quote:${bitgetSymbol}`;

    // Vérifier cache (mémoire → BD)
    const cached = await cache.getWithFallback<Quote>(key);
    if (cached) return cached;

    try {
      const url = `${BITGET_BASE}/tickers?symbol=${bitgetSymbol}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Bitget API error: ${res.status}`);
      }

      const json = (await res.json()) as any;

      if (json.code !== "00000" || !json.data?.[0]) {
        throw new Error(`Bitget API error: ${json.msg || "No data"}`);
      }

      const ticker = json.data[0];

      // Retourner le format Bitget exact avec le nom ajouté
      const quote: Quote = {
        symbol,
        name: symbol,
        ...ticker,
      };

      // Sauvegarder en cache (mémoire + BD)
      cache.set(key, quote, CACHE_TTL.QUOTE);
      await cache.setDb(key, quote, "quote", CACHE_TTL.QUOTE, "bitget");

      return quote;
    } catch (error) {
      logger.error(
        `❌ Error fetching quote from Bitget for ${symbol}:`,
        getErrorMessage(error),
      );
      throw error;
    }
  }

  /**
   * Recherche de symboles cryptos via les tickers Bitget
   */
  async fetchSuggestions(query: string, limit = 20): Promise<Suggestion[]> {
    const key = `bitget:suggestions:${query.toLowerCase()}`;

    // Vérifier cache (mémoire → BD)
    const cached = await cache.getWithFallback<Suggestion[]>(key);
    if (cached) {
      logger.debug(
        `📊 Suggestions pour "${query}": ${cached.length} résultats (cache)`,
      );
      return cached.slice(0, limit);
    }

    try {
      // Récupérer tous les tickers Bitget
      const url = `${BITGET_BASE}/tickers`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Bitget API error: ${res.status}`);
      }

      const json = (await res.json()) as any;

      if (json.code !== "00000" || !json.data) {
        throw new Error(`Bitget API error: ${json.msg || "No data"}`);
      }

      const searchTerm = query.toUpperCase();
      const suggestions: Suggestion[] = json.data
        .filter((ticker: any) => ticker.symbol.includes(searchTerm))
        .slice(0, limit)
        .map((ticker: any) => ({
          symbol: ticker.symbol,
          name: ticker.symbol,
          type: "CRYPTO" as SymbolType,
          exchange: "Bitget",
        }));

      // Sauvegarder en cache (mémoire 1h + BD 24h)
      const memoryTTL = 60 * 60; // 1 heure
      const dbTTL = 24 * 60 * 60; // 24 heures

      cache.set(key, suggestions, memoryTTL);
      await cache.setDb(key, suggestions, "suggestions", dbTTL, "bitget");

      logger.info(
        `📊 Suggestions pour "${query}": ${suggestions.length} résultats (API)`,
      );
      return suggestions.slice(0, limit);
    } catch (error) {
      logger.error(
        `❌ Error fetching suggestions from Bitget:`,
        getErrorMessage(error),
      );
      return cached ?? [];
    }
  }

  /**
   * Récupère les métadonnées d'un symbole crypto
   * Pour les cryptos, seul le type est pertinent (les prix/volumes sont dans Quote)
   * 1. Table Symbol (persistant)
   * 2. Table Cache (backup, TTL 30 jours)
   * 3. Retour direct (type CRYPTO)
   */
  async fetchMetadata(symbol: string): Promise<SymbolMetadata> {
    const bitgetSymbol = this.normalizeSymbol(symbol);
    const cacheKey = `bitget:metadata:${bitgetSymbol}`;

    try {
      // 1. Vérifier table Symbol
      const dbSymbol = await prisma.symbol.findUnique({
        where: { name: bitgetSymbol },
        select: { metadata: true, symbolType: true },
      });

      if (dbSymbol?.metadata) {
        const metadata = dbSymbol.metadata as any;
        return {
          symbol: bitgetSymbol,
          name: metadata.name || bitgetSymbol,
          type: (dbSymbol.symbolType as SymbolType) || ("CRYPTO" as SymbolType),
          data: metadata.data || {},
        };
      }

      // 2. Vérifier cache
      const cached = await cache.getWithFallback<SymbolMetadata>(cacheKey);
      if (cached) return cached;

      // 3. Construire métadonnées (juste le type pour les cryptos)
      // Détecter la paire de cotation
      const quoteCurrency =
        new RegExp(/(USDT|USDC|BUSD)$/).exec(bitgetSymbol)?.[1] || "USDT";
      const baseCurrency = bitgetSymbol.replace(
        new RegExp(`${quoteCurrency}$`),
        "",
      );

      const metadata: SymbolMetadata = {
        symbol: bitgetSymbol,
        name: bitgetSymbol,
        type: "CRYPTO" as SymbolType,
        data: {
          quoteCurrency,
          baseCurrency,
          exchange: "Bitget",
        },
      };

      // Sauvegarder en cache (mémoire 5min + BD 30 jours - données statiques)
      cache.set(cacheKey, metadata, CACHE_TTL.OHLC);
      await cache.setDb(
        cacheKey,
        metadata,
        "metadata",
        30 * 24 * 60 * 60,
        "bitget",
      );

      return metadata;
    } catch (error) {
      logger.error(
        `❌ Error fetching metadata from Bitget for ${symbol}:`,
        getErrorMessage(error),
      );
      throw error;
    }
  }
}

// Export instance singleton
export const bitget = new BitgetProvider();
