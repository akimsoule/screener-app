import { fetchQuote, SymbolType } from "../../../lib/data/index.js";
import { yahoo } from "../../../lib/data/provider/yahoo.js";
import { cache } from "../../../lib/cache.js";
import type { MacroContextInput } from "./macroService.js";
import { logger } from "../../../lib/logger.js";

/**
 * SERVICE DE RÉCUPÉRATION DES DONNÉES MACROÉCONOMIQUES
 * Récupère les données depuis FRED API + Yahoo Finance
 */

interface MacroMetadata {
  vix?: number;
  spyChange?: number;
  goldChange?: number;
  fedFundsRate?: number;
  fearGreed?: {
    value: number;
    classification: string;
    interpretation: string;
  };
  timestamp: string;
  source: string;
  fredApiAvailable: boolean;
  note: string;
  error?: string; // Pour les erreurs dans le fallback
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function interpretFearGreed(value: number): string {
  if (value < 25) return "Extreme Fear - Opportunité d'achat potentielle";
  if (value < 45) return "Fear - Marché prudent";
  if (value < 55) return "Neutral - Équilibre";
  if (value < 75) return "Greed - Marché optimiste";
  return "Extreme Greed - Potentiel sommet";
}

async function tryFetchFredData(apiKey: string) {
  try {
    const [ismPmi, m2Growth, fedFundsRate] = await Promise.all([
      fetchFredSeries("MANEMP", apiKey), // ISM Manufacturing PMI
      fetchFredGrowthYoY("M2SL", apiKey), // M2 Money Supply (YoY)
      fetchFredSeries("DFF", apiKey), // Federal Funds Effective Rate
    ]);
    return { ismPmi, m2Growth, fedFundsRate, useFredData: true };
  } catch (fredError) {
    logger.error(
      "FRED API failed, using estimates:",
      getErrorMessage(fredError),
    );
    return {
      ismPmi: null,
      m2Growth: null,
      fedFundsRate: null,
      useFredData: false,
    };
  }
}

/**
 * Récupère le Fear & Greed Index depuis Alternative.me
 * API gratuite : https://alternative.me/crypto/fear-and-greed-index/
 * Retourne un score 0-100 : 0 = Extreme Fear, 100 = Extreme Greed
 * Cache : 1 heure (données mises à jour quotidiennement)
 */
async function fetchFearGreedIndex(): Promise<{
  value: number;
  classification: string;
} | null> {
  const cacheKey = "fear-greed:crypto:index";

  // Essayer de récupérer depuis le cache d'abord (TTL 1h)
  const cached = await cache.getWithFallback<{
    value: number;
    classification: string;
  }>(cacheKey);

  if (cached) {
    logger.debug(`🎭 Fear & Greed Index (cache)`);
    return cached;
  }

  try {
    const response = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!response.ok) {
      logger.error(`Fear & Greed API error: ${response.status}`);
      return null;
    }
    const data = (await response.json()) as {
      data?: Array<{ value: string; value_classification: string }>;
    };
    if (!data.data || data.data.length === 0) return null;

    const value = Number.parseInt(data.data[0].value, 10);
    const classification = data.data[0].value_classification;

    if (Number.isNaN(value)) return null;

    const result = { value, classification };

    // Mettre en cache pour 1 heure (3600 secondes)
    await cache.setDb(cacheKey, result, "metadata", 3600, "alternative.me");

    logger.info(`🎭 Fear & Greed Index: ${value}/100 (${classification})`);
    return result;
  } catch (error) {
    logger.error("Failed to fetch Fear & Greed Index:", getErrorMessage(error));
    return null;
  }
}

/**
 * Récupère une série économique depuis FRED API
 * API Key gratuite : https://fred.stlouisfed.org/docs/api/api_key.html
 * Cache : 1 heure (données économiques mises à jour quotidiennement/mensuellement)
 */
async function fetchFredSeries(
  seriesId: string,
  apiKey: string,
  limit = 1,
): Promise<number | null> {
  const cacheKey = `fred:series:${seriesId}:${limit}`;

  // Essayer de récupérer depuis le cache d'abord (TTL 1h)
  const cached = await cache.getWithFallback<number>(cacheKey);
  if (cached !== null && cached !== undefined) {
    logger.debug(`📊 FRED ${seriesId} (cache)`);
    return cached;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=${limit}&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) {
      logger.error(`FRED API error for ${seriesId}: ${response.status}`);
      return null;
    }
    const data = (await response.json()) as {
      observations?: Array<{ value: string }>;
    };
    const observations = data.observations || [];
    if (observations.length === 0) return null;
    const value = Number.parseFloat(observations[0].value);
    if (Number.isNaN(value)) return null;

    // Mettre en cache pour 1 heure (3600 secondes)
    await cache.setDb(cacheKey, value, "metadata", 3600, "fred-api");

    logger.info(`📊 FRED ${seriesId}: ${value}`);
    return value;
  } catch (error) {
    logger.error(
      `Failed to fetch FRED series ${seriesId}:`,
      getErrorMessage(error),
    );
    return null;
  }
}

/**
 * Calcule la croissance YoY d'une série FRED
 * Cache : 6 heures (calcul basé sur 13 points de données)
 */
async function fetchFredGrowthYoY(
  seriesId: string,
  apiKey: string,
): Promise<number | null> {
  const cacheKey = `fred:yoy:${seriesId}`;

  // Essayer de récupérer depuis le cache d'abord (TTL 6h)
  const cached = await cache.getWithFallback<number>(cacheKey);
  if (cached !== null && cached !== undefined) {
    logger.debug(`📊 FRED ${seriesId} YoY (cache)`);
    return cached;
  }

  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&limit=13&sort_order=desc`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      observations?: Array<{ value: string }>;
    };
    const observations = data.observations || [];
    if (observations.length < 13) return null;

    const latest = Number.parseFloat(observations[0].value);
    const yearAgo = Number.parseFloat(observations[12].value);

    if (Number.isNaN(latest) || Number.isNaN(yearAgo) || yearAgo === 0)
      return null;

    const yoyGrowth = ((latest - yearAgo) / yearAgo) * 100;

    // Mettre en cache pour 6 heures (21600 secondes)
    await cache.setDb(cacheKey, yoyGrowth, "metadata", 21600, "fred-api");

    logger.info(`📊 FRED ${seriesId} YoY: ${yoyGrowth.toFixed(2)}%`);
    return yoyGrowth;
  } catch (error) {
    logger.error(
      `Failed to calculate YoY growth for ${seriesId}:`,
      getErrorMessage(error),
    );
    return null;
  }
}

/**
 * Récupère les données macroéconomiques réelles depuis FRED API + Yahoo Finance
 */
export async function fetchRealMacroData(): Promise<
  MacroContextInput & { _metadata?: MacroMetadata }
> {
  // Récupération de la clé API FRED depuis les variables d'environnement
  const FRED_API_KEY = process.env.FRED_API_KEY || "";

  try {
    // Données Yahoo Finance + Fear & Greed Index (toujours disponibles)
    const [dxyCloses, vixQuote, spyQuote, goldQuote, fearGreed] =
      await Promise.all([
        yahoo
          .fetchOHLC("DX-Y.NYB", "1d")
          .then((data) => data.slice(-60).map((d) => d.close)), // 3 mois
        fetchQuote("^VIX", SymbolType.US_STOCK),
        fetchQuote("SPY", SymbolType.US_STOCK),
        fetchQuote("GLD", SymbolType.US_STOCK),
        fetchFearGreedIndex(),
      ]);

    const dxyMomentum =
      dxyCloses.length >= 2
        ? ((dxyCloses.at(-1)! - dxyCloses.at(0)!) / dxyCloses.at(0)!) * 100
        : 1.2;

    const vixLevel = vixQuote?.lastPr ? Number.parseFloat(vixQuote.lastPr) : 20;
    const spyChange = spyQuote?.changeUtc24h
      ? Number.parseFloat(spyQuote.changeUtc24h) * 100
      : 0;
    const goldChange = goldQuote?.changeUtc24h
      ? Number.parseFloat(goldQuote.changeUtc24h) * 100
      : 0;

    let ismPmi: number | null = null;
    let m2Growth: number | null = null;
    let fedFundsRate: number | null = null;
    let useFredData = false;

    // Tentative de récupération des données FRED (si clé API disponible)
    if (FRED_API_KEY) {
      const fredResult = await tryFetchFredData(FRED_API_KEY);
      ismPmi = fredResult.ismPmi;
      m2Growth = fredResult.m2Growth;
      fedFundsRate = fredResult.fedFundsRate;
      useFredData = fredResult.useFredData;
    }

    // Fallback sur estimations si FRED n'est pas disponible
    // Appliquer des valeurs par défaut si FRED n'a pas retourné de données
    const applyFredFallbacks = (
      ism: number | null,
      m2: number | null,
      fed: number | null,
      vix: number,
      spyChg: number,
    ) => {
      if (!ism) ism = spyChg > 0 ? 52.5 : 48.5;
      if (!m2) m2 = vix < 20 ? 6.5 : 4;
      if (!fed) fed = 5.25; // Estimation actuelle
      return { ism, m2, fed } as const;
    };

    ({
      ism: ismPmi,
      m2: m2Growth,
      fed: fedFundsRate,
    } = applyFredFallbacks(
      ismPmi,
      m2Growth,
      fedFundsRate,
      vixLevel,
      spyChange,
    ));

    // Fed Dot Plot et Market Pricing (estimations basées sur le taux actuel)
    // En production, scraper depuis le site de la Fed ou utiliser Bloomberg
    const fedDotPlot2025 = fedFundsRate + 0.5;
    const marketPricing2025 = fedFundsRate + 0.25;

    // NFP Surprise (estimation basée sur volatilité)
    // En production, récupérer depuis un calendrier économique (Investing.com API, etc.)
    const nfpSurprise = vixLevel < 15 ? 50000 : -25000;

    return {
      fedDotPlot2025: Number(fedDotPlot2025.toFixed(2)),
      marketPricing2025: Number(marketPricing2025.toFixed(2)),
      ismPmi: Number(ismPmi.toFixed(1)),
      dxyMomentum: Number(dxyMomentum.toFixed(2)),
      m2Growth: Number(m2Growth.toFixed(2)),
      nfpSurprise: Math.round(nfpSurprise),
      _metadata: {
        vix: vixLevel,
        spyChange,
        goldChange,
        fedFundsRate,
        fearGreed: fearGreed
          ? {
              value: fearGreed.value,
              classification: fearGreed.classification,
              interpretation: interpretFearGreed(fearGreed.value),
            }
          : undefined,
        timestamp: new Date().toISOString(),
        source: useFredData ? "fred-api-real" : "yahoo-finance-estimated",
        fredApiAvailable: !!FRED_API_KEY,
        note: useFredData
          ? "Données officielles FRED + Yahoo Finance + Fear & Greed"
          : "Estimations basées sur prix de marché (FRED_API_KEY manquante)",
      },
    };
  } catch (error) {
    logger.error("Failed to fetch real macro data:", getErrorMessage(error));
    // Fallback complet sur données de démonstration
    return {
      fedDotPlot2025: 3.75,
      marketPricing2025: 3.5,
      ismPmi: 52.5,
      dxyMomentum: 1.2,
      m2Growth: 6.2,
      nfpSurprise: -25000,
      _metadata: {
        source: "fallback-demo",
        error: getErrorMessage(error),
        fredApiAvailable: false,
        timestamp: new Date().toISOString(),
        note: "Données de démonstration (erreur de récupération des données réelles)",
      },
    };
  }
}
