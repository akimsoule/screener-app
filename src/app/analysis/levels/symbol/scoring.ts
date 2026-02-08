/**
 * ⚙️ SCORING ENGINE
 *
 * Calcul du score technique basé sur plusieurs indicateurs :
 * - RSI (momentum)
 * - Tendance (SMA daily/weekly)
 * - MACD (signal directionnel)
 * - Bollinger Bands (mean reversion / continuation)
 * - ADX (force de tendance)
 * - ATR (volatilité)
 */

import { RSI, SMA, MACD, ATR, BollingerBands, ADX } from "technicalindicators";
import type { MacroRegime, SymbolMetadata } from "../../types";
import {
  INDICATOR_PERIODS,
  REGIME_THRESHOLDS,
  SCORE_WEIGHTS,
  RSI_LEVELS,
  LIOT_BIAS,
  ASSET_PATTERNS,
} from "../../constants";

// ===== SCORE RSI =====

export function scoreRSI(rsi: number, regime: string): number {
  let score = 0;
  if (regime.includes("TREND")) {
    if (rsi > RSI_LEVELS.OVERBOUGHT_WEAK) score -= SCORE_WEIGHTS.RSI_OVERBOUGHT;
    else if (rsi < RSI_LEVELS.OVERSOLD_WEAK)
      score += SCORE_WEIGHTS.RSI_OVERSOLD;
  } else if (rsi > RSI_LEVELS.OVERBOUGHT_STRONG) {
    score -= SCORE_WEIGHTS.RSI_OVERBOUGHT;
  } else if (rsi < RSI_LEVELS.OVERSOLD_STRONG) {
    score += SCORE_WEIGHTS.RSI_OVERSOLD;
  }
  return score;
}

// ===== SCORE TENDANCE =====

export function scoreTrend(
  dailyCloses: number[],
  weeklyCloses: number[],
  rsi: number,
  regime: string,
) {
  const sma50 = SMA.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.SMA_SHORT,
  }).at(-1)!;
  const sma200 = SMA.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.SMA_LONG,
  }).at(-1)!;
  const sma20W = SMA.calculate({
    values: weeklyCloses,
    period: INDICATOR_PERIODS.SMA_WEEKLY,
  }).at(-1)!;

  const trendDaily = sma50 > sma200 ? "BULL" : "BEAR";
  const trendWeekly = weeklyCloses.at(-1)! > sma20W ? "BULL" : "BEAR";

  let score = 0;
  if (regime.includes("TREND")) {
    if (rsi > RSI_LEVELS.NEUTRAL && trendDaily === "BULL")
      score += SCORE_WEIGHTS.RSI_TREND_CONTINUATION;
    else if (rsi < RSI_LEVELS.NEUTRAL && trendDaily === "BEAR")
      score -= SCORE_WEIGHTS.RSI_TREND_CONTINUATION;
  }
  score +=
    trendDaily === "BULL"
      ? SCORE_WEIGHTS.TREND_DAILY
      : -SCORE_WEIGHTS.TREND_DAILY;
  score +=
    trendWeekly === "BULL"
      ? SCORE_WEIGHTS.TREND_WEEKLY
      : -SCORE_WEIGHTS.TREND_WEEKLY;
  if (trendDaily === trendWeekly)
    score +=
      trendDaily === "BULL"
        ? SCORE_WEIGHTS.TREND_ALIGNED
        : -SCORE_WEIGHTS.TREND_ALIGNED;

  return { score, trendDaily, trendWeekly };
}

// ===== SCORE MACD =====

export function scoreMACD(dailyCloses: number[]): number {
  const macd = MACD.calculate({
    values: dailyCloses,
    fastPeriod: INDICATOR_PERIODS.MACD_FAST,
    slowPeriod: INDICATOR_PERIODS.MACD_SLOW,
    signalPeriod: INDICATOR_PERIODS.MACD_SIGNAL,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const m0 = macd.at(-1)!;
  const m1 = macd.at(-2)!;

  let score =
    m0.MACD! > m0.signal!
      ? SCORE_WEIGHTS.MACD_SIGNAL
      : -SCORE_WEIGHTS.MACD_SIGNAL;
  if (m0.histogram! > m1.histogram! && m0.histogram! > 0)
    score += SCORE_WEIGHTS.MACD_ACCELERATION;
  if (m0.histogram! < m1.histogram! && m0.histogram! < 0)
    score -= SCORE_WEIGHTS.MACD_ACCELERATION;
  return score;
}

// ===== SCORE BOLLINGER BANDS =====

export function scoreBB(
  dailyCloses: number[],
  price: number,
  rsi: number,
  regime: string,
  trendDaily: string,
): number {
  const bb = BollingerBands.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.BOLLINGER_BANDS,
    stdDev: INDICATOR_PERIODS.BOLLINGER_STD_DEV,
  }).at(-1)!;
  let score = 0;
  if (regime.includes("TREND")) {
    if (price > bb.upper && trendDaily === "BULL")
      score += SCORE_WEIGHTS.BB_TREND_CONTINUATION;
    if (price < bb.lower && trendDaily === "BEAR")
      score -= SCORE_WEIGHTS.BB_TREND_CONTINUATION;
  } else {
    if (price < bb.lower && rsi < RSI_LEVELS.OVERSOLD_WEAK)
      score += SCORE_WEIGHTS.BB_MEAN_REVERSION;
    if (price > bb.upper && rsi > RSI_LEVELS.OVERBOUGHT_WEAK)
      score -= SCORE_WEIGHTS.BB_MEAN_REVERSION;
  }
  return score;
}

// ===== SCORE ADX (Trend Strength) =====

export function scoreADX(
  dailyHighs: number[],
  dailyLows: number[],
  dailyCloses: number[],
  regime: string,
) {
  const adxResult = ADX.calculate({
    period: INDICATOR_PERIODS.ADX,
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
  });
  const adx = adxResult.at(-1)!.adx;
  let score = 0;
  if (adx > REGIME_THRESHOLDS.ADX_STRONG_TREND && regime.includes("TREND"))
    score += SCORE_WEIGHTS.ADX_TREND_BOOST;
  if (adx < REGIME_THRESHOLDS.ADX_RANGE && regime === "RANGE")
    score += SCORE_WEIGHTS.ADX_RANGE_BOOST;
  return { score, adx };
}

// ===== SCORE ATR (Volatilité) =====

export function scoreATR(
  dailyHighs: number[],
  dailyLows: number[],
  dailyCloses: number[],
  price: number,
  riskFlags: string[],
) {
  const atr = ATR.calculate({
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
    period: INDICATOR_PERIODS.ATR_SHORT,
  }).at(-1)!;
  const atr50 = ATR.calculate({
    high: dailyHighs,
    low: dailyLows,
    close: dailyCloses,
    period: INDICATOR_PERIODS.ATR_LONG,
  }).at(-1)!;
  const atrPercent = (atr / price) * 100;
  let score = 0;
  if (atr > atr50 * REGIME_THRESHOLDS.ATR_MULTIPLIER_EXTREME) {
    score += SCORE_WEIGHTS.VOLATILITY_EXTREME;
    riskFlags.push("VOLATILITE_EXTREME");
  }
  if (atr < atr50 * REGIME_THRESHOLDS.ATR_MULTIPLIER_LOW) {
    score += SCORE_WEIGHTS.VOLATILITY_LOW;
    riskFlags.push("FAIBLE_VOLATILITE");
  }
  return { score, atr, atrPercent };
}

// ===== SCORE TECHNIQUE COMPLET =====

export function computeTechnicalScore(
  dailyCloses: number[],
  dailyHighs: number[],
  dailyLows: number[],
  weeklyCloses: number[],
  price: number,
  regime: string,
) {
  const riskFlags: string[] = [];

  const rsi = RSI.calculate({
    values: dailyCloses,
    period: INDICATOR_PERIODS.RSI,
  }).at(-1)!;
  let rawScore = 0;

  rawScore += scoreRSI(rsi, regime);

  const trendRes = scoreTrend(dailyCloses, weeklyCloses, rsi, regime);
  rawScore += trendRes.score;

  rawScore += scoreMACD(dailyCloses);
  rawScore += scoreBB(dailyCloses, price, rsi, regime, trendRes.trendDaily);

  const adxRes = scoreADX(dailyHighs, dailyLows, dailyCloses, regime);
  rawScore += adxRes.score;

  const atrRes = scoreATR(dailyHighs, dailyLows, dailyCloses, price, riskFlags);
  rawScore += atrRes.score;

  return {
    rawScore,
    riskFlags,
    rsi,
    adx: adxRes.adx,
    trendDaily: trendRes.trendDaily,
    trendWeekly: trendRes.trendWeekly,
    atr: atrRes.atr,
    atrPercent: atrRes.atrPercent,
  };
}

// =============== BIAIS MACRO LIOT ===============

export type AssetClass =
  | "equities"
  | "bonds"
  | "commodities"
  | "crypto"
  | "forex";

export function getAssetClass(
  symbol: string,
  metadata?: SymbolMetadata,
): AssetClass {
  if (metadata?.type) {
    const fromMeta = getAssetClassFromMetadata(metadata, symbol);
    if (fromMeta) return fromMeta;
  }

  return getAssetClassFromPatterns(symbol);
}

function getAssetClassFromMetadata(
  metadata: SymbolMetadata,
  symbol: string,
): AssetClass | null {
  if (!metadata.type) return null;

  const type = metadata.type.toUpperCase();
  const sector = metadata.data?.sector?.toUpperCase() || "";
  const industry = metadata.data?.industry?.toUpperCase() || "";
  const upperSymbol = symbol.toUpperCase();

  if (type === "CRYPTOCURRENCY" || type.includes("CRYPTO")) {
    return "crypto";
  }

  if (type === "ETF") {
    if (
      sector.includes("BOND") ||
      sector.includes("FIXED INCOME") ||
      industry.includes("BOND") ||
      ["TLT", "IEF", "AGG", "BND", "HYG", "LQD", "MUB", "GOVT"].includes(
        upperSymbol,
      )
    ) {
      return "bonds";
    }

    if (
      sector.includes("COMMODIT") ||
      sector.includes("PRECIOUS METAL") ||
      industry.includes("GOLD") ||
      industry.includes("SILVER") ||
      ["GLD", "SLV", "USO", "UNG", "DBA", "DBC", "PDBC", "IAU"].includes(
        upperSymbol,
      )
    ) {
      return "commodities";
    }

    return "equities";
  }

  if (type === "EQUITY" || type.includes("STOCK")) {
    if (
      sector === "BASIC MATERIALS" ||
      industry.includes("GOLD") ||
      industry.includes("SILVER") ||
      industry.includes("PRECIOUS METAL") ||
      industry.includes("MINING")
    ) {
      return "commodities";
    }

    return "equities";
  }

  if (type.includes("BOND") || type.includes("TREASURY")) return "bonds";
  if (type.includes("COMMODITY") || type.includes("FUTURE"))
    return "commodities";
  if (
    type.includes("FOREX") ||
    type.includes("FX") ||
    type.includes("CURRENCY")
  )
    return "forex";

  return null;
}

function getAssetClassFromPatterns(symbol: string): AssetClass {
  const upperSymbol = symbol.toUpperCase();

  if (ASSET_PATTERNS.CRYPTO.some((x) => upperSymbol.includes(x)))
    return "crypto";
  if (
    ASSET_PATTERNS.BONDS_ETF.includes(
      upperSymbol as (typeof ASSET_PATTERNS.BONDS_ETF)[number],
    )
  )
    return "bonds";
  if (
    ASSET_PATTERNS.COMMODITIES_ETF.includes(
      upperSymbol as (typeof ASSET_PATTERNS.COMMODITIES_ETF)[number],
    )
  )
    return "commodities";
  if (ASSET_PATTERNS.FOREX.some((x) => upperSymbol.includes(x))) return "forex";

  return "equities";
}

// ===== BIAIS OR/DOLLAR =====

export function handleDollarBiasForGold(
  symbol: string,
  macroRegime: MacroRegime,
  _price: number = 0,
): number {
  const upper = symbol.toUpperCase();
  const isGold =
    upper.includes("GC") ||
    upper.includes("XAU") ||
    upper.includes("GLD") ||
    upper.includes("GOLD");
  if (!isGold) return 0;

  if (macroRegime.dollarRegime === "STRENGTHENING") {
    return -25;
  }
  if (macroRegime.dollarRegime === "WEAK") {
    return 20;
  }
  return 0;
}

// ===== CALCUL GLOBAL DU BIAIS LIOT =====

export function calculateLiotBias(
  symbol: string,
  macroRegime: MacroRegime,
  metadata?: SymbolMetadata,
  currentPrice?: number,
): number {
  const assetClass = getAssetClass(symbol, metadata);

  return (
    handleLiquidityBias(assetClass, macroRegime) +
    handleCycleBias(assetClass, macroRegime) +
    handlePhaseBias(assetClass, macroRegime) +
    handleDollarBias(assetClass, macroRegime) +
    handleDollarBiasForGold(symbol, macroRegime, currentPrice) +
    handleSeasonalityBias(assetClass)
  );
}

function handleLiquidityBias(
  assetClass: AssetClass,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.liquidity !== "EXPANDING") return 0;
  switch (assetClass) {
    case "equities":
      return LIOT_BIAS.LIQUIDITY_EQUITIES;
    case "crypto":
      return LIOT_BIAS.LIQUIDITY_CRYPTO;
    case "commodities":
      return LIOT_BIAS.LIQUIDITY_COMMODITIES;
    case "bonds":
      return LIOT_BIAS.LIQUIDITY_BONDS;
    default:
      return 0;
  }
}

function handleCycleBias(
  assetClass: AssetClass,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.cycleStage !== "LATE_CYCLE") return 0;
  switch (assetClass) {
    case "crypto":
      return LIOT_BIAS.LATE_CYCLE_CRYPTO;
    case "bonds":
      return LIOT_BIAS.LATE_CYCLE_BONDS;
    case "equities":
      return LIOT_BIAS.LATE_CYCLE_EQUITIES;
    default:
      return 0;
  }
}

function handlePhaseBias(
  assetClass: AssetClass,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.phase === "RISK_ON") {
    if (assetClass === "equities") return LIOT_BIAS.RISK_ON_EQUITIES;
    if (assetClass === "crypto") return LIOT_BIAS.RISK_ON_CRYPTO;
    return 0;
  }

  if (macroRegime.phase === "RISK_OFF") {
    if (assetClass === "bonds") return LIOT_BIAS.RISK_OFF_BONDS;
    if (assetClass === "equities") return LIOT_BIAS.RISK_OFF_EQUITIES;
    if (assetClass === "crypto") return LIOT_BIAS.RISK_OFF_CRYPTO;
  }

  return 0;
}

function handleDollarBias(
  assetClass: AssetClass,
  macroRegime: MacroRegime,
): number {
  if (macroRegime.dollarRegime === "WEAK") {
    if (assetClass === "commodities") return LIOT_BIAS.WEAK_DOLLAR_COMMODITIES;
    if (assetClass === "crypto") return LIOT_BIAS.WEAK_DOLLAR_CRYPTO;
    return 0;
  }

  if (macroRegime.dollarRegime === "STRENGTHENING") {
    if (assetClass === "forex") return LIOT_BIAS.STRONG_DOLLAR_FOREX;
    if (assetClass === "commodities")
      return LIOT_BIAS.STRONG_DOLLAR_COMMODITIES;
    if (assetClass === "crypto") return LIOT_BIAS.STRONG_DOLLAR_CRYPTO;
  }

  return 0;
}

function handleSeasonalityBias(assetClass: AssetClass): number {
  const now = new Date();
  if (now.getMonth() === 9 && assetClass === "crypto") {
    return LIOT_BIAS.OCTOBER_CRYPTO_BOOST;
  }
  return 0;
}

// ===== DRAPEAUX MACRO =====

export function computeMacroRegimeFlags(macroRegime: MacroRegime): string[] {
  const flags: string[] = [];
  if (macroRegime.cycleStage === "LATE_CYCLE")
    flags.push("LATE_CYCLE_DETECTED");
  if (macroRegime.dollarRegime === "STRENGTHENING")
    flags.push("DOLLAR_REBOUND_POTENTIAL");
  if (macroRegime.liquidity === "EXPANDING") flags.push("LIQUIDITY_RISK_ON");
  return flags;
}

// ===== ENRICHISSEMENT INTERPRÉTATION =====

export function enrichInterpretationWithMacro(
  interpretation: string,
  macroRegime: MacroRegime,
): string {
  const liotInsights: string[] = [];
  if (macroRegime.cycleStage === "LATE_CYCLE")
    liotInsights.push("⚠️ LATE CYCLE détecté (prudence recommandée)");
  if (macroRegime.dollarRegime === "STRENGTHENING")
    liotInsights.push(
      "💵 Dollar en renforcement (pression sur actifs risqués)",
    );
  if (macroRegime.phase === "RISK_ON")
    liotInsights.push(
      "📈 Environnement RISK-ON (favorable aux actifs risqués)",
    );
  else if (macroRegime.phase === "RISK_OFF")
    liotInsights.push("📉 Environnement RISK-OFF (prudence)");
  if (macroRegime.liquidity === "EXPANDING")
    liotInsights.push("💧 Liquidité en expansion (support haussier)");

  if (liotInsights.length === 0) return interpretation;
  return interpretation + "\n\n🌍 Contexte macro :\n" + liotInsights.join("\n");
}
