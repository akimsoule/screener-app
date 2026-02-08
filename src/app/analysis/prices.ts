// prices.ts
// Retrieve price series from Finnhub
import { fetchOHLC, fetchQuote, SymbolType } from "../../lib/data";
import type { OHLC } from "./types";
import { logger } from "../../lib/logger.js";

// Patterns de détection
const CRYPTO_PATTERN = /(USDT|USDC|BUSD|USD|EUR|BTC)$/i;
const CANADA_PATTERN = /\.(TO|V|NE)$/i;
const INTERNATIONAL_PATTERN = /\.[A-Z]{1,3}$/i;

/**
 * Détecter le type de symbole basé sur sa notation
 */
export function detectSymbolType(symbol: string): SymbolType {
  // Cryptos: BTCUSDT, ETHUSDT, BTC-USD, ETH-EUR, etc.
  if (CRYPTO_PATTERN.test(symbol)) {
    return SymbolType.CRYPTO;
  }

  // Actions canadiennes: suffixe .TO, .V, .NE
  if (CANADA_PATTERN.test(symbol)) {
    return SymbolType.CANADIAN_STOCK;
  }

  // International: autres suffixes (ex: .L pour Londres, .PA pour Paris)
  if (
    INTERNATIONAL_PATTERN.test(symbol) &&
    !symbol.toUpperCase().endsWith(".US")
  ) {
    return SymbolType.INTERNATIONAL;
  }

  // Par défaut: actions US
  return SymbolType.US_STOCK;
}

export async function getPrices(
  symbol: string,
  interval: "15min" | "1h" | "4h" | "1d" | "1wk" = "1d",
): Promise<OHLC[]> {
  try {
    const symbolType = detectSymbolType(symbol);
    const data = await fetchOHLC(symbol, symbolType, interval);
    logger.info(`📊 ${symbol} (${interval}): ${data.length} candles reçues`);
    return data;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error(`❌ getPrices(${symbol}, ${interval}) failed:`, errorMessage);
    // Ne pas supprimer automatiquement - peut être temporaire
    return [];
  }
}

export async function getMarketData(symbol: string) {
  try {
    const symbolType = detectSymbolType(symbol);
    return await fetchQuote(symbol, symbolType);
  } catch (e) {
    // L'erreur est déjà loggée dans fetchQuote
    logger.warn(
      `⚠️ Impossible de récupérer le prix pour ${symbol}: ${e instanceof Error ? e.message : String(e)}`,
    );
    return { price: 0 };
  }
}

export default getPrices;
