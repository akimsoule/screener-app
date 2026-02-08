/**
 * 🔬 MAIN ANALYZER
 *
 * Fonction principale d'analyse des symboles avec intégration :
 * - Analyse technique multi-timeframe (Daily + Weekly + Hourly conditionnelle)
 * - Contexte macroéconomique (LIOT framework)
 * - Évaluation du risque et recommandations
 * - Métadonnées enrichies
 */

import { SymbolType } from "../../../../lib/data";
import { getPrices, detectSymbolType } from "../../prices";
import type {
  AnalysisReport,
  RiskConfig,
  MacroRegime,
  VolatilityRegime,
  HourlyTiming,
  SymbolMetadata,
} from "../../types";
import {
  DATA_REQUIREMENTS,
  REGIME_THRESHOLDS,
  TRADE_PARAMS,
} from "../../constants";
import { logger } from "../../../../lib/logger";

import {
  DEFAULT_RISK_CONFIG,
  clamp,
  normalizeScore,
  scoreToAction,
  interpretScore,
} from "./utils";
import { detectRegime } from "./regime";
import { analyzeHourlyTiming } from "./timing";
import { assessRisk } from "./risk";
import { buildRecommendation } from "./recommendation";
import {
  computeTechnicalScore,
  calculateLiotBias,
  computeMacroRegimeFlags,
  enrichInterpretationWithMacro,
} from "./scoring";

/**
 * Tente d'analyser le timing hourly si le score le justifie (|score| >= 40)
 */
async function maybeAnalyzeHourlyTiming(
  symbol: string,
  score: number,
  action: string,
  price: number,
  isCrypto: boolean,
): Promise<HourlyTiming | undefined> {
  const shouldAnalyzeHourly = Math.abs(score) >= 40;
  if (!shouldAnalyzeHourly) return undefined;

  try {
    logger.debug(`🔍 ${symbol} - Score ${score} >= 40, analyse hourly activée`);
    const hourlyOhlc = await getPrices(symbol, "1h");

    const minHourly = isCrypto
      ? DATA_REQUIREMENTS.CRYPTO_MIN_HOURLY_CANDLES
      : DATA_REQUIREMENTS.MIN_HOURLY_CANDLES;

    if (hourlyOhlc.length >= minHourly) {
      const side = action.includes("BUY") ? "LONG" : "SHORT";
      const timing = analyzeHourlyTiming(hourlyOhlc, price, side);
      logger.debug(`📊 ${symbol} - Hourly timing: ${timing.recommendation}`);
      return timing;
    }

    logger.warn(
      `⚠️ ${symbol} - Données hourly insuffisantes (${hourlyOhlc.length}/${minHourly})`,
    );
    return undefined;
  } catch (error) {
    logger.warn(
      `⚠️ ${symbol} - Échec analyse hourly: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

/**
 * Analyse complète d'un symbole avec score technique + contexte macro
 *
 * @param symbol - Symbole à analyser (ex: "AAPL", "BTC-USD")
 * @param riskConfig - Configuration du risque (capital, risque par trade, etc.)
 * @param macroRegime - Contexte macroéconomique (optionnel)
 * @param metadata - Métadonnées du symbole (type, secteur, industrie, etc.)
 * @returns Rapport d'analyse complet avec recommandations
 */
export async function analyzeSymbol(
  symbol: string,
  riskConfig: Partial<RiskConfig> = {},
  macroRegime?: MacroRegime,
  metadata?: SymbolMetadata,
): Promise<AnalysisReport> {
  const config = { ...DEFAULT_RISK_CONFIG, ...riskConfig };

  // Récupération des données OHLC (Daily + Weekly)
  const [dailyOhlc, weeklyOhlc] = await Promise.all([
    getPrices(symbol, "1d"),
    getPrices(symbol, "1wk"),
  ]);

  // Détecter le type de symbole
  const symbolType = detectSymbolType(symbol);
  const isCrypto = symbolType === SymbolType.CRYPTO;

  // Requirements standards
  let minDaily = isCrypto
    ? DATA_REQUIREMENTS.CRYPTO_MIN_DAILY_CANDLES
    : DATA_REQUIREMENTS.MIN_DAILY_CANDLES;
  let minWeekly = isCrypto
    ? DATA_REQUIREMENTS.CRYPTO_MIN_WEEKLY_CANDLES
    : DATA_REQUIREMENTS.MIN_WEEKLY_CANDLES;

  // ✨ TRAITEMENT SPÉCIAL POUR LES EQUITIES
  // Si equity avec données insuffisantes, appliquer des exigences réduites
  const isEquity = !isCrypto;
  if (isEquity) {
    const hasLimitedData =
      dailyOhlc.length < DATA_REQUIREMENTS.MIN_DAILY_CANDLES ||
      weeklyOhlc.length < DATA_REQUIREMENTS.MIN_WEEKLY_CANDLES;

    if (hasLimitedData) {
      // Exigences minimales pour equity récente/peu liquide
      const EQUITY_FALLBACK_MIN_DAILY = 100; // ~4-5 mois
      const EQUITY_FALLBACK_MIN_WEEKLY = 20; // ~5 mois

      // Vérifier si on a au moins les minimums de fallback
      if (
        dailyOhlc.length >= EQUITY_FALLBACK_MIN_DAILY &&
        weeklyOhlc.length >= EQUITY_FALLBACK_MIN_WEEKLY
      ) {
        logger.info(
          `⚠️ ${symbol} - Equity avec données limitées, application exigences réduites (${dailyOhlc.length}j, ${weeklyOhlc.length}s)`,
        );
        minDaily = EQUITY_FALLBACK_MIN_DAILY;
        minWeekly = EQUITY_FALLBACK_MIN_WEEKLY;
      }
    }
  }

  logger.debug(
    `🔍 ${symbol} - Type: ${isCrypto ? "CRYPTO" : "EQUITY"} | Daily: ${dailyOhlc.length}/${minDaily} | Weekly: ${weeklyOhlc.length}/${minWeekly}`,
  );

  if (dailyOhlc.length < minDaily || weeklyOhlc.length < minWeekly) {
    throw new Error(
      `Données insuffisantes pour ${symbol} (${dailyOhlc.length}/${minDaily}j, ${weeklyOhlc.length}/${minWeekly}s). Type: ${isCrypto ? "crypto" : "equity"}`,
    );
  }

  const price = dailyOhlc.at(-1)!.close;
  const regime = detectRegime(dailyOhlc);

  // Extraction des séries
  const dailyCloses = dailyOhlc.map((o) => o.close);
  const dailyHighs = dailyOhlc.map((o) => o.high);
  const dailyLows = dailyOhlc.map((o) => o.low);
  const weeklyCloses = weeklyOhlc.map((o) => o.close);

  // =============== CALCUL DU SCORE ===============

  const {
    rawScore,
    riskFlags,
    rsi,
    adx,
    trendDaily,
    trendWeekly,
    atr,
    atrPercent,
  } = computeTechnicalScore(
    dailyCloses,
    dailyHighs,
    dailyLows,
    weeklyCloses,
    price,
    regime,
  );

  /* Score final (technique + macro) */
  let liotBias = 0;
  let finalRawScore = rawScore;

  if (macroRegime) {
    const macroFlags = computeMacroRegimeFlags(macroRegime);
    riskFlags.push(...macroFlags);
    liotBias = calculateLiotBias(symbol, macroRegime, metadata, price);
    finalRawScore = rawScore + liotBias;
  }

  const score = normalizeScore(
    finalRawScore,
    100, // SCORE_NORMALIZATION.MAX_THEORETICAL
  );
  const action = scoreToAction(score);
  const confidence = Math.abs(score);

  let interpretation = interpretScore(score);
  if (macroRegime) {
    interpretation = enrichInterpretationWithMacro(interpretation, macroRegime);
  }

  /* Évaluation de la qualité du signal */
  const riskAssessment = await assessRisk(symbol, price, atr, score, {
    config,
    macroRegime,
    lastCandle: dailyOhlc.at(-1),
  });

  // Volatility regime
  let volatilityRegime: VolatilityRegime;
  if (atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_EXTREME)
    volatilityRegime = "HIGH";
  else if (atrPercent < REGIME_THRESHOLDS.ATR_PERCENT_LOW)
    volatilityRegime = "LOW";
  else volatilityRegime = "NORMAL";

  // =============== ANALYSE HOURLY (CONDITIONNELLE - SCORE |>= 40|) ===============

  const hourlyTiming = await maybeAnalyzeHourlyTiming(
    symbol,
    score,
    action,
    price,
    isCrypto,
  );

  /* Recommandation */
  const recommendation = buildRecommendation(
    action,
    price,
    atr,
    score,
    riskAssessment,
    hourlyTiming,
    {
      regime,
      volatilityRegime,
    },
  );

  /* Métriques de performance estimées */
  const winRateEstimate = clamp(
    TRADE_PARAMS.BASE_WIN_RATE +
      Math.abs(score) / TRADE_PARAMS.WIN_RATE_SCORE_FACTOR,
    TRADE_PARAMS.MIN_WIN_RATE,
    TRADE_PARAMS.MAX_WIN_RATE,
  );
  const avgWin = recommendation.riskReward * TRADE_PARAMS.AVG_WIN_PENALTY;
  const avgLoss = TRADE_PARAMS.AVG_LOSS;
  const expectancy = winRateEstimate * avgWin - (1 - winRateEstimate) * avgLoss;

  return {
    symbol,
    timestamp: new Date(),
    regime,
    rawScore,
    score,
    action,
    confidence,
    interpretation,
    riskFlags: [...riskFlags],
    details: {
      price,
      rsi,
      adx,
      trendDaily,
      trendWeekly,
      atr,
      atrPercent,
      volatilityRegime,
    },
    recommendation,
    metrics: {
      winRateEstimate: winRateEstimate * 100,
      expectancy,
      maxAdverseExcursion: atr * TRADE_PARAMS.MAX_ADVERSE_EXCURSION_ATR,
    },
    macroContext: macroRegime,
    liotBias: liotBias === 0 ? undefined : liotBias,
  };
}
