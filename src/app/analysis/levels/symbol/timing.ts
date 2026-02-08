import { RSI, SMA } from "technicalindicators";
import type { OHLC, HourlyTiming } from "../../types";
import { INDICATOR_PERIODS } from "../../constants";

/**
 * Analyse hourly pour affiner le timing d'entrée (Score |≥ 40| uniquement)
 * Détecte le momentum court terme et les niveaux de support/résistance
 */
export function analyzeHourlyTiming(
  hourlyOhlc: OHLC[],
  currentPrice: number,
  side: "LONG" | "SHORT",
): HourlyTiming {
  const hourlyCloses = hourlyOhlc.map((o) => o.close);

  // RSI hourly pour momentum court terme
  const rsiHourly = RSI.calculate({
    values: hourlyCloses,
    period: INDICATOR_PERIODS.RSI_HOURLY,
  });
  const rsi = rsiHourly.at(-1)!;

  // SMA20 hourly pour tendance court terme
  const sma20h = SMA.calculate({
    values: hourlyCloses,
    period: INDICATOR_PERIODS.SMA_HOURLY,
  });
  const sma = sma20h.at(-1)!;

  // Momentum hourly
  const momentum = currentPrice > sma ? "BULL" : "BEAR";

  // Support/Résistance récents (dernières 48h)
  const recent48h = hourlyOhlc.slice(-48);
  const recentHighs = recent48h.map((o) => o.high);
  const recentLows = recent48h.map((o) => o.low);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);

  const distanceToResistance =
    ((resistance - currentPrice) / currentPrice) * 100;
  const distanceToSupport = ((currentPrice - support) / currentPrice) * 100;

  const nearResistance = distanceToResistance < 1.5; // < 1.5%
  const nearSupport = distanceToSupport < 1.5;

  // Recommandation de timing
  const timing =
    side === "LONG"
      ? analyzeLongTiming(
          nearSupport,
          nearResistance,
          rsi,
          momentum,
          currentPrice,
          support,
        )
      : analyzeShortTiming(
          nearSupport,
          nearResistance,
          rsi,
          momentum,
          currentPrice,
          resistance,
        );

  return {
    momentum,
    rsi,
    nearSupport,
    nearResistance,
    recommendation: timing.recommendation,
    optimalEntry: timing.optimalEntry,
  };
}

// ===== HELPERS =====

function analyzeLongTiming(
  nearSupport: boolean,
  nearResistance: boolean,
  rsi: number,
  momentum: "BULL" | "BEAR" | "NEUTRAL",
  currentPrice: number,
  support: number,
): { recommendation: string; optimalEntry?: number } {
  if (nearSupport && rsi < 40) {
    return {
      recommendation:
        "🎯 Timing optimal : proche support + RSI oversold hourly",
      optimalEntry: currentPrice,
    };
  }
  if (nearResistance) {
    return {
      recommendation: "⏳ Attendre pullback : trop proche résistance hourly",
      optimalEntry: support + (currentPrice - support) * 0.382,
    };
  }
  if (momentum === "BULL" && rsi > 50 && rsi < 70) {
    return {
      recommendation: "✅ Momentum hourly favorable : entrée validée",
      optimalEntry: currentPrice,
    };
  }
  if (rsi > 70) {
    return {
      recommendation: "⚠️ RSI hourly surachat : attendre consolidation",
    };
  }
  return {
    recommendation: "🔄 Momentum neutre : setup valide, timing acceptable",
    optimalEntry: currentPrice,
  };
}

function analyzeShortTiming(
  nearSupport: boolean,
  nearResistance: boolean,
  rsi: number,
  momentum: "BULL" | "BEAR" | "NEUTRAL",
  currentPrice: number,
  resistance: number,
): { recommendation: string; optimalEntry?: number } {
  if (nearResistance && rsi > 60) {
    return {
      recommendation:
        "🎯 Timing optimal : proche résistance + RSI overbought hourly",
      optimalEntry: currentPrice,
    };
  }
  if (nearSupport) {
    return {
      recommendation: "⏳ Attendre rebond : trop proche support hourly",
      optimalEntry: resistance - (resistance - currentPrice) * 0.382,
    };
  }
  if (momentum === "BEAR" && rsi < 50 && rsi > 30) {
    return {
      recommendation: "✅ Momentum hourly favorable : entrée validée",
      optimalEntry: currentPrice,
    };
  }
  if (rsi < 30) {
    return {
      recommendation: "⚠️ RSI hourly survente : attendre rebond",
    };
  }
  return {
    recommendation: "🔄 Momentum neutre : setup valide, timing acceptable",
    optimalEntry: currentPrice,
  };
}
