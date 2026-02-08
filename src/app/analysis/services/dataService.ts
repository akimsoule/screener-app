import { bitget } from "../../lib/data/provider/bitget.js";
import { yahoo } from "../../lib/data/provider/yahoo.js";
import type {
  SymbolType,
  Suggestion,
  OHLC,
  SymbolMetadata,
  Quote,
} from "../../lib/data/provider/types.js";
import { logger, getErrorMessage } from "../../lib/logger.js";

/**
 * SERVICE DE DONNÉES - COUCHE MÉTIER
 * Encapsule la logique de routing vers les différents providers (Bitget, Yahoo)
 * Séparation claire entre l'infrastructure (providers) et la logique métier (routing)
 */
export class DataService {
  /**
   * Récupérer des suggestions basées sur le type de symbole
   */
  async fetchSuggestions(
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
   */
  async fetchOHLC(
    symbol: string,
    symbolType: SymbolType,
    interval = "1d",
  ): Promise<OHLC[]> {
    switch (symbolType) {
      case "CRYPTO":
        return bitget.fetchOHLC(symbol, interval);
      case "US_STOCK":
      case "CANADIAN_STOCK":
      case "INTERNATIONAL":
        return yahoo.fetchOHLC(symbol, interval);
      default:
        throw new Error(`Unknown symbol type: ${symbolType}`);
    }
  }

  /**
   * Récupérer les métadonnées d'un symbole
   */
  async fetchMetadata(
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
  async fetchQuote(
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
          return null;
      }
    } catch (error) {
      logger.error(
        `❌ Error fetching quote for ${symbol}:`,
        getErrorMessage(error),
      );
      return null;
    }
  }
}

// Export singleton
export const dataService = new DataService();
