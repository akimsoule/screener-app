// Data provider: dispatcher basé sur le type de symbole
// - Bitget pour les cryptos (gratuit)
// - Yahoo Finance pour les actions (gratuit)

import { bitget } from "./provider/bitget.js";
import { yahoo } from "./provider/yahoo.js";
import type {
  SymbolType,
  Suggestion,
  OHLC,
  SymbolMetadata,
  Quote,
} from "./provider/types.js";

import { dummyScreener } from "./provider/dummyScreener.js";
import { logger, getErrorMessage } from "../logger.js";

export { SymbolType, TimeInterval } from "./provider/types.js";

/**
 * Récupérer des suggestions basées sur le type de symbole
 */
export async function fetchSuggestions(
  query: string,
  symbolType: SymbolType,
  limit = 20,
): Promise<Suggestion[]> {
  try {
    switch (symbolType) {
      case "CRYPTO":
        return await bitget.fetchSuggestions(query, limit);
      case "US_STOCK":
      case "CANADIAN_STOCK":
      case "INTERNATIONAL":
        return await yahoo.fetchSuggestions(query, limit);
      default:
        return [];
    }
  } catch (error) {
    logger.error(
      `❌ Error fetching suggestions for ${query}:`,
      getErrorMessage(error),
    );
    return [];
  }
}

/**
 * Récupérer les données OHLC basées sur le type de symbole
 * @param symbol - Le symbole à récupérer
 * @param symbolType - Le type de symbole
 * @param interval - Intervalle de temps (15min, 1h, 4h, 1d, 1wk)
 */
export async function fetchOHLC(
  symbol: string,
  symbolType: SymbolType,
  interval = "1d",
): Promise<OHLC[]> {
  switch (symbolType) {
    case "CRYPTO":
      // Cryptos: toujours Bitget
      return bitget.fetchOHLC(symbol, interval);
    case "US_STOCK":
    case "CANADIAN_STOCK":
    case "INTERNATIONAL":
      // Actions: toujours Yahoo Finance (gratuit, fiable)
      return yahoo.fetchOHLC(symbol, interval);
    default:
      throw new Error(`Unknown symbol type: ${symbolType}`);
  }
}

/**
 * Récupérer les métadonnées d'un symbole
 */
export async function fetchMetadata(
  symbol: string,
  symbolType: SymbolType,
): Promise<SymbolMetadata | null> {
  try {
    switch (symbolType) {
      case "CRYPTO":
        return await bitget.fetchMetadata(symbol);
      case "US_STOCK":
      case "CANADIAN_STOCK":
      case "INTERNATIONAL":
        return await yahoo.fetchMetadata(symbol);
      default:
        return null;
    }
  } catch (error) {
    logger.error(
      `❌ Error fetching metadata for ${symbol}:`,
      getErrorMessage(error),
    );
    return null;
  }
}

/**
 * Récupérer le quote actuel d'un symbole
 */
export async function fetchQuote(
  symbol: string,
  symbolType: SymbolType,
): Promise<Quote | null> {
  try {
    switch (symbolType) {
      case "CRYPTO":
        return await bitget.fetchQuote(symbol);
      case "US_STOCK":
      case "CANADIAN_STOCK":
      case "INTERNATIONAL":
        return await yahoo.fetchQuote(symbol);
      default:
        throw new Error(`Unknown symbol type: ${symbolType}`);
    }
  } catch (error) {
    // L'erreur est déjà loggée par le provider (Yahoo/Bitget)
    return null;
  }
}

export async function fetchSymbolsFromDummyScreener(): Promise<string[]> {
  try {
    return await dummyScreener.fetchCanadianSymbol();
  } catch (error) {
    logger.error(
      "❌ Error fetching symbols from dummy screener:",
      getErrorMessage(error),
    );
    return [];
  }
}

export default {
  fetchSuggestions,
  fetchOHLC,
  fetchMetadata,
  fetchQuote,
  fetchSymbolsFromDummyScreener,
};
