import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export interface FilterOptions {
  symbolType?: string | string[];
  isPopular?: boolean;
  exchange?: string | string[];
  sector?: string | string[];
  industry?: string | string[];
  quoteCurrency?: string | string[];
  provider?: string | string[];
  enabled?: boolean;
  // Filtres numériques (min/max)
  dividendYieldMin?: number;
  dividendYieldMax?: number;
  peRatioMin?: number;
  peRatioMax?: number;
  marketCapMin?: number;
  marketCapMax?: number;
  hasDividend?: boolean; // Filtre pour les symboles qui versent des dividendes
}

// ===== HELPERS =====

/**
 * Vérifie si une valeur metadata correspond à un ensemble de valeurs possibles
 */
function matchesMetadataValue(
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
function parseMetadataNumber(metadata: any, path: string): number | null {
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
 * Parse les valeurs numériques d'un champ de métadonnées
 */
function collectNumericValues(symbols: any[], fieldPath: string): number[] {
  const values: number[] = [];
  for (const symbol of symbols) {
    const value = parseMetadataNumber(symbol.metadata, fieldPath);
    if (value !== null) values.push(value);
  }
  return values;
}

/**
 * Parse les valeurs de texte d'un champ de métadonnées
 */
function collectTextValues(symbols: any[], fieldPath: string): Set<string> {
  const values = new Set<string>();
  for (const symbol of symbols) {
    const parts = fieldPath.split(".");
    let val = symbol.metadata;
    for (const part of parts) {
      val = val?.[part];
      if (val === undefined) break;
    }
    if (typeof val === "string" && val) {
      values.add(val);
    }
  }
  return values;
}

/**
 * Service de filtrage des symboles basé sur les métadonnées
 */
export class FilterService {
  /**
   * Construit les conditions WHERE pour Prisma
   */
  private buildWhereClause(options: FilterOptions): Prisma.SymbolWhereInput {
    const where: Prisma.SymbolWhereInput = {};

    if (options.symbolType) {
      where.symbolType = Array.isArray(options.symbolType)
        ? { in: options.symbolType }
        : options.symbolType;
    }

    if (options.isPopular !== undefined) {
      where.isPopular = options.isPopular;
    }

    if (options.enabled !== undefined) {
      where.enabled = options.enabled;
    }

    if (options.provider) {
      where.provider = Array.isArray(options.provider)
        ? { in: options.provider }
        : options.provider;
    }

    return where;
  }

  /**
   * Applique des filtres aux symboles en base de données
   */
  async filterSymbols(options: FilterOptions = {}) {
    const where = this.buildWhereClause(options);

    const symbols = await prisma.symbol.findMany({
      where,
      select: {
        id: true,
        name: true,
        symbolType: true,
        isPopular: true,
        provider: true,
        metadata: true,
        lastAction: true,
        lastScore: true,
        lastPrice: true,
        enabled: true,
      },
      orderBy: [{ isPopular: "desc" }, { symbolType: "asc" }, { name: "asc" }],
    });

    // Filtrage en JavaScript pour les métadonnées JSON
    let filteredSymbols = symbols;

    // Appliquer filtres texte (exchange, sector, industry, quoteCurrency)
    if (options.exchange) {
      filteredSymbols = filteredSymbols.filter((s) =>
        matchesMetadataValue(s.metadata, "data.exchange", options.exchange!),
      );
    }

    if (options.sector) {
      filteredSymbols = filteredSymbols.filter((s) =>
        matchesMetadataValue(s.metadata, "data.sector", options.sector!),
      );
    }

    if (options.industry) {
      filteredSymbols = filteredSymbols.filter((s) =>
        matchesMetadataValue(s.metadata, "data.industry", options.industry!),
      );
    }

    if (options.quoteCurrency) {
      filteredSymbols = filteredSymbols.filter((s) =>
        matchesMetadataValue(
          s.metadata,
          "data.quoteCurrency",
          options.quoteCurrency!,
        ),
      );
    }

    // Filtre par présence de dividendes
    if (options.hasDividend !== undefined) {
      filteredSymbols = filteredSymbols.filter((s) => {
        const metadata = s.metadata as any;
        const hasDividend =
          metadata?.data?.dividendYield || metadata?.data?.dividendRate;
        return options.hasDividend ? !!hasDividend : !hasDividend;
      });
    }

    // Filtre par rendement de dividende (min/max)
    if (
      options.dividendYieldMin !== undefined ||
      options.dividendYieldMax !== undefined
    ) {
      filteredSymbols = filteredSymbols.filter((s) => {
        const yieldValue = parseMetadataNumber(
          s.metadata,
          "data.dividendYield",
        );
        if (yieldValue === null) return false;

        const min = options.dividendYieldMin ?? -Infinity;
        const max = options.dividendYieldMax ?? Infinity;
        return yieldValue >= min && yieldValue <= max;
      });
    }

    // Filtre par ratio P/E (min/max)
    if (options.peRatioMin !== undefined || options.peRatioMax !== undefined) {
      filteredSymbols = filteredSymbols.filter((s) => {
        const peValue = parseMetadataNumber(s.metadata, "data.peRatio");
        if (peValue === null) return false;

        const min = options.peRatioMin ?? -Infinity;
        const max = options.peRatioMax ?? Infinity;
        return peValue >= min && peValue <= max;
      });
    }

    // Filtre par capitalisation boursière (min/max)
    if (
      options.marketCapMin !== undefined ||
      options.marketCapMax !== undefined
    ) {
      filteredSymbols = filteredSymbols.filter((s) => {
        const capValue = parseMetadataNumber(s.metadata, "data.marketCap");
        if (capValue === null) return false;

        const min = options.marketCapMin ?? -Infinity;
        const max = options.marketCapMax ?? Infinity;
        return capValue >= min && capValue <= max;
      });
    }

    return filteredSymbols;
  }

  /**
   * Récupère les symboles populaires
   */
  async getPopularSymbols() {
    return this.filterSymbols({ isPopular: true });
  }

  /**
   * Récupère les valeurs distinctes pour un champ de métadonnées
   */
  async getDistinctMetadataValues(
    field: keyof FilterOptions,
  ): Promise<string[]> {
    const symbols = await prisma.symbol.findMany({
      where: {
        metadata: {
          not: Prisma.JsonNull,
        },
      },
      select: {
        metadata: true,
      },
    });

    const values = new Set<string>();
    for (const symbol of symbols) {
      const metadata = symbol.metadata as any;
      let value: string | undefined;

      switch (field) {
        case "exchange":
          value = metadata?.data?.exchange;
          break;
        case "sector":
          value = metadata?.data?.sector;
          break;
        case "industry":
          value = metadata?.data?.industry;
          break;
        case "quoteCurrency":
          value = metadata?.data?.quoteCurrency;
          break;
        case "hasDividend": {
          // Pour hasDividend, on retourne "true" ou "false"
          const hasDividend =
            metadata?.data?.dividendYield || metadata?.data?.dividendRate;
          value = hasDividend ? "true" : "false";
          break;
        }
      }

      if (value) {
        values.add(value);
      }
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Récupère les statistiques des symboles par type
   */
  async getSymbolStats() {
    const stats = await prisma.symbol.groupBy({
      by: ["symbolType", "isPopular", "enabled"],
      _count: {
        id: true,
      },
    });

    return stats.reduce(
      (acc, stat) => {
        const key = `${stat.symbolType || "UNKNOWN"}_${stat.isPopular ? "POPULAR" : "REGULAR"}_${stat.enabled ? "ENABLED" : "DISABLED"}`;
        acc[key] = stat._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Filtre pour les cryptomonnaies
   */
  async getCryptoSymbols(quoteCurrency?: string | string[]) {
    return this.filterSymbols({
      symbolType: "CRYPTO",
      ...(quoteCurrency && { quoteCurrency }),
    });
  }

  /**
   * Filtre pour les actions par secteur
   */
  async getStocksBySector(sector: string | string[]) {
    return this.filterSymbols({
      symbolType: ["US_STOCK", "CANADIAN_STOCK", "INTERNATIONAL"],
      sector,
    });
  }

  /**
   * Filtre pour les actions par industrie
   */
  async getStocksByIndustry(industry: string | string[]) {
    return this.filterSymbols({
      symbolType: ["US_STOCK", "CANADIAN_STOCK", "INTERNATIONAL"],
      industry,
    });
  }

  /**
   * Recherche de symboles par nom (contient)
   */
  async searchSymbols(query: string, limit = 20) {
    const symbols = await prisma.symbol.findMany({
      where: {
        name: {
          contains: query.toUpperCase(),
          mode: "insensitive",
        },
        enabled: true,
      },
      select: {
        id: true,
        name: true,
        symbolType: true,
        isPopular: true,
        provider: true,
        metadata: true,
        lastAction: true,
        lastScore: true,
        lastPrice: true,
      },
      orderBy: [{ isPopular: "desc" }, { name: "asc" }],
      take: limit,
    });

    return symbols;
  }

  /**
   * Filtre pour les actions à dividendes
   */
  async getStocksWithDividends(minYield?: number) {
    const options: FilterOptions = {
      symbolType: ["US_STOCK", "CANADIAN_STOCK", "INTERNATIONAL"],
      hasDividend: true,
    };

    if (minYield !== undefined) {
      options.dividendYieldMin = minYield;
    }

    return this.filterSymbols(options);
  }

  /**
   * Récupère les statistiques sur les dividendes
   */
  async getDividendStats() {
    const stocks = await prisma.symbol.findMany({
      where: {
        symbolType: { in: ["US_STOCK", "CANADIAN_STOCK", "INTERNATIONAL"] },
        enabled: true,
      },
      select: {
        metadata: true,
      },
    });

    let withDividend = 0;
    let withoutDividend = 0;
    const yields: number[] = [];

    for (const stock of stocks) {
      const metadata = stock.metadata as any;
      const yieldStr = metadata?.data?.dividendYield;

      if (yieldStr) {
        withDividend++;
        const yieldValue = Number.parseFloat(yieldStr);
        if (!Number.isNaN(yieldValue)) {
          yields.push(yieldValue);
        }
      } else {
        withoutDividend++;
      }
    }

    yields.sort((a, b) => a - b);

    return {
      total: stocks.length,
      withDividend,
      withoutDividend,
      averageYield:
        yields.length > 0
          ? yields.reduce((a, b) => a + b, 0) / yields.length
          : 0,
      medianYield:
        yields.length > 0 ? yields[Math.floor(yields.length / 2)] : 0,
      minYield: yields.length > 0 ? yields[0] : 0,
      maxYield: yields.length > 0 ? yields.at(-1) : 0,
    };
  }

  /**
   * Récupère tous les filtres disponibles basés sur les symbols actifs
   */
  async getAvailableFilters() {
    const symbols = await prisma.symbol.findMany({
      where: { enabled: true },
      select: {
        symbolType: true,
        metadata: true,
      },
    });

    // Collecte des filtres booléens
    const symbolTypes = new Set<string>();
    for (const symbol of symbols) {
      if (symbol.symbolType) symbolTypes.add(symbol.symbolType);
    }

    const sectors = collectTextValues(symbols, "data.sector");
    const industries = collectTextValues(symbols, "data.industry");
    const exchanges = collectTextValues(symbols, "data.exchange");
    const quoteCurrencies = collectTextValues(symbols, "data.quoteCurrency");

    // Collecte des filtres numériques
    const dividendYields = collectNumericValues(symbols, "data.dividendYield");
    const peRatios = collectNumericValues(symbols, "data.peRatio");
    const marketCaps = collectNumericValues(symbols, "data.marketCap");

    return {
      booleanFilters: {
        symbolType: Array.from(symbolTypes).sort((a, b) => a.localeCompare(b)),
        sector: Array.from(sectors).sort((a, b) => a.localeCompare(b)),
        industry: Array.from(industries).sort((a, b) => a.localeCompare(b)),
        exchange: Array.from(exchanges).sort((a, b) => a.localeCompare(b)),
        quoteCurrency: Array.from(quoteCurrencies).sort((a, b) =>
          a.localeCompare(b),
        ),
      },
      rangeFilters: {
        dividendYield: {
          min: dividendYields.length > 0 ? Math.min(...dividendYields) : 0,
          max: dividendYields.length > 0 ? Math.max(...dividendYields) : 0,
          unit: "%",
        },
        peRatio: {
          min: peRatios.length > 0 ? Math.min(...peRatios) : 0,
          max: peRatios.length > 0 ? Math.max(...peRatios) : 0,
        },
        marketCap: {
          min: marketCaps.length > 0 ? Math.min(...marketCaps) : 0,
          max: marketCaps.length > 0 ? Math.max(...marketCaps) : 0,
          unit: "USD",
        },
      },
    };
  }
}

// Instance singleton
export const filterService = new FilterService();
