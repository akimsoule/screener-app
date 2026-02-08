// Types partagés pour les providers de données

export enum SymbolType {
  CRYPTO = "CRYPTO",
  US_STOCK = "US_STOCK",
  CANADIAN_STOCK = "CANADIAN_STOCK",
  INTERNATIONAL = "INTERNATIONAL",
}

export enum TimeInterval {
  FIFTEEN_MIN = "15min",
  ONE_HOUR = "1h",
  FOUR_HOUR = "4h",
  ONE_DAY = "1d",
  ONE_WEEK = "1wk",
}

export interface Suggestion {
  symbol: string;
  name: string;
  type: SymbolType;
  exchange?: string;
}

export interface OHLC {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Métadonnées d'un symbole (format flexible JSON)
 * Permet de stocker toute information supplémentaire selon le provider
 */
export interface SymbolMetadata {
  /** Symbole (ex: "AAPL", "BTCUSDT") */
  symbol: string;

  /** Nom complet */
  name: string;

  /** Type de symbole */
  type: SymbolType;

  /** Données flexibles spécifiques au provider */
  data: Record<string, string>;
}

/**
 * Quote en temps réel (format Bitget)
 * Représente les données de marché actuelles pour un symbole
 */
export interface Quote {
  /** Symbole (ex: "BTCUSDT", "AAPL") */
  symbol: string;

  /** Nom complet du symbole */
  name: string;

  /** Prix d'ouverture (24h pour crypto, session pour actions) */
  open: string;

  /** Plus haut sur 24h */
  high24h: string;

  /** Plus bas sur 24h */
  low24h: string;

  /** Dernier prix tradé */
  lastPr: string;

  /** Volume en quote currency (ex: USDT pour BTCUSDT) */
  quoteVolume: string;

  /** Volume en base currency (ex: BTC pour BTCUSDT) */
  baseVolume: string;

  /** Volume en USDT (normalisé) */
  usdtVolume: string;

  /** Timestamp en millisecondes */
  ts: string;

  /** Meilleur prix d'achat (bid) */
  bidPr: string;

  /** Meilleur prix de vente (ask) */
  askPr: string;

  /** Taille du bid */
  bidSz: string;

  /** Taille de l'ask */
  askSz: string;

  /** Prix d'ouverture UTC */
  openUtc: string;

  /** Changement UTC sur 24h (décimal, ex: "0.04516" = +4.516%) */
  changeUtc24h: string;

  /** Changement sur 24h (décimal, ex: "-0.09338" = -9.338%) */
  change24h: string;
}

export interface CanadianSymbol {
  symbol: string;
  name: string;
  exchange: string; // TSX ou TSXV
  assetType: string;
}

/**
 * Generic row returned by a screener provider (e.g. Yahoo predefined screeners)
 */
export interface ScreenerResultRow {
  symbol: string;
  shortName?: string;
  longName?: string;
  exchange?: string;
  regularMarketPrice?: number;
  regularMarketVolume?: number;
}

/**
 * Interface for Screener providers (Yahoo, FMP, etc.)
 */
export interface ScreenerProvider {
  /** Provider name for logging */
  name: string;

  /**
   * Fetch Canadian symbols (strings) from the screener
   * @param scrIds - list of screener ids
   * @param count - number of rows per screener
   */
  fetchCanadianSymbol: (scrIds?: string[], count?: number) => Promise<string[]>;
}

/**
 * Interface que tous les providers de données doivent implémenter
 *
 * Un provider est responsable de fournir des données financières pour un type d'actif spécifique.
 * Chaque provider peut choisir d'implémenter tout ou partie de ces méthodes selon ses capacités.
 *
 * @example
 * // Provider Bitget (cryptos uniquement)
 * export const bitgetProvider: DataProvider = {
 *   name: "Bitget",
 *   supportedTypes: [SymbolType.CRYPTO],
 *   fetchOHLC: async (symbol, interval) => { ... },
 *   fetchQuote: async (symbol) => { ... },
 *   fetchSuggestions: undefined, // Non supporté
 *   fetchMetadata: undefined,    // Non supporté
 * };
 *
 * @example
 * // Provider Yahoo Finance (actions uniquement)
 * export const yahooProvider: DataProvider = {
 *   name: "Yahoo Finance",
 *   supportedTypes: [SymbolType.US_STOCK, SymbolType.CANADIAN_STOCK, SymbolType.INTERNATIONAL],
 *   fetchOHLC: async (symbol, interval) => { ... },
 *   fetchQuote: undefined,       // Non supporté (utilise OHLC à la place)
 *   fetchSuggestions: undefined, // Non supporté
 *   fetchMetadata: undefined,    // Non supporté
 * };
 */
export interface DataProvider {
  /** Nom du provider (pour logging/debugging) */
  name: string;

  /** Types d'actifs supportés par ce provider */
  supportedTypes: SymbolType[];

  /**
   * Récupère les données OHLC (chandelier) historiques
   * @param symbol - Le symbole à récupérer (ex: "AAPL", "BTCUSDT")
   * @param interval - Intervalle de temps (ex: "1d", "1h", "15m")
   * @returns Liste de chandeliers OHLC, triée par date croissante
   * @required Cette méthode est obligatoire pour tous les providers
   */
  fetchOHLC: (symbol: string, interval: string) => Promise<OHLC[]>;

  /**
   * Récupère le prix actuel en temps réel
   * @param symbol - Le symbole à récupérer
   * @returns Prix actuel ou null si non disponible
   * @optional Peut retourner undefined si le provider ne supporte pas cette fonctionnalité
   */
  fetchQuote: (symbol: string) => Promise<Quote>;

  /**
   * Recherche de symboles par mot-clé (autocomplétion)
   * @param query - Texte de recherche (ex: "apple", "btc")
   * @returns Liste de suggestions de symboles
   * @optional Peut retourner undefined si le provider ne supporte pas cette fonctionnalité
   */
  fetchSuggestions: (query: string, limit: number) => Promise<Suggestion[]>;

  /**
   * Récupère les métadonnées d'un symbole (nom complet, secteur, industrie, etc.)
   * @param symbol - Le symbole à récupérer
   * @returns Métadonnées complètes ou null si non disponible
   * @optional Peut retourner undefined si le provider ne supporte pas cette fonctionnalité
   */
  fetchMetadata: (symbol: string) => Promise<SymbolMetadata>;
}
