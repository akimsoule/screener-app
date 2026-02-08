import type {
  AnalysisReport,
  TradeRecommendation,
  RiskAssessment,
  Regime,
  VolatilityRegime,
  HourlyTiming,
} from "../../types";
import {
  TRADE_PARAMS,
  SCORE_THRESHOLDS,
  HOLDING_PERIODS,
} from "../../constants";

/**
 * Construit la recommandation de trade (entrée, sortie, sizing)
 */
export function buildRecommendation(
  action: AnalysisReport["action"],
  price: number,
  atr: number,
  score: number,
  riskAssessment: RiskAssessment,
  hourlyTiming: HourlyTiming | undefined,
  opts: {
    regime: Regime;
    volatilityRegime: VolatilityRegime;
  },
): TradeRecommendation {
  const { regime, volatilityRegime } = opts;
  let side: "LONG" | "SHORT" | "NONE" = "NONE";
  if (action.includes("BUY")) side = "LONG";
  else if (action.includes("SELL")) side = "SHORT";
  const isLong = side === "LONG";

  if (side === "NONE") {
    return {
      side: "NONE",
      entry: price,
      stopLoss: price,
      takeProfit: price,
      riskReward: 0,
      sizing: null,
      rationale: "Aucune opportunité identifiée (score neutre)",
      holdingPeriod: {
        min: 0,
        max: 0,
        target: 0,
        description: "N/A",
      },
    };
  }

  // RR dynamique selon qualité du setup
  let baseRR: number = TRADE_PARAMS.RR_STANDARD;
  if (Math.abs(score) >= SCORE_THRESHOLDS.STRONG_BUY) {
    baseRR = TRADE_PARAMS.RR_PREMIUM;
  } else if (Math.abs(score) >= SCORE_THRESHOLDS.BUY) {
    baseRR = TRADE_PARAMS.RR_GOOD;
  }
  const STOP_ATR = isLong
    ? TRADE_PARAMS.STOP_ATR_LONG
    : TRADE_PARAMS.STOP_ATR_SHORT;

  const entry = price;
  const stopLoss = isLong ? price - atr * STOP_ATR : price + atr * STOP_ATR;
  const risk = Math.abs(entry - stopLoss);
  const takeProfit = isLong ? entry + risk * baseRR : entry - risk * baseRR;

  let sizing: null = null;
  let rationale = "";

  if (riskAssessment.approved && risk > 0) {
    rationale = `✅ Trade autorisé | Risque estimé: ${(riskAssessment.adjustedRiskPercent * 100).toFixed(2)}%`;
  } else {
    rationale = `❌ Trade refusé (${riskAssessment.flags.join(", ")})`;
  }

  const holdingPeriod = estimateHoldingPeriod(regime, volatilityRegime, score);

  return {
    side,
    entry: hourlyTiming?.optimalEntry
      ? Number(hourlyTiming.optimalEntry.toFixed(2))
      : Number(entry.toFixed(2)),
    stopLoss: Number(stopLoss.toFixed(2)),
    takeProfit: Number(takeProfit.toFixed(2)),
    riskReward: baseRR,
    sizing,
    rationale,
    holdingPeriod,
    hourlyTiming,
  };
}

/**
 * Estime la durée de détention optimale selon le régime et la volatilité
 */
export function estimateHoldingPeriod(
  regime: Regime,
  volatilityRegime: VolatilityRegime,
  score: number,
): TradeRecommendation["holdingPeriod"] {
  const baseHolding = HOLDING_PERIODS[regime];
  let min = baseHolding.min;
  let max = baseHolding.max;
  let target = baseHolding.target;

  // Ajustement volatilité
  let volFactor = 1;
  if (volatilityRegime === "HIGH") {
    volFactor = HOLDING_PERIODS.HIGH_VOLATILITY_FACTOR;
  } else if (volatilityRegime === "LOW") {
    volFactor = HOLDING_PERIODS.LOW_VOLATILITY_FACTOR;
  }

  // Ajustement qualité du setup
  let qualityFactor = 1;
  if (Math.abs(score) >= SCORE_THRESHOLDS.STRONG_BUY) {
    qualityFactor = HOLDING_PERIODS.PREMIUM_SETUP_FACTOR;
  } else if (Math.abs(score) < SCORE_THRESHOLDS.BUY) {
    qualityFactor = HOLDING_PERIODS.WEAK_SETUP_FACTOR;
  }

  const combinedFactor = volFactor * qualityFactor;
  min = Math.round(min * combinedFactor);
  max = Math.round(max * combinedFactor);
  target = Math.round(target * combinedFactor);

  let description = "";
  if (target <= 5) {
    description = "Court terme (intraday/swing rapide)";
  } else if (target <= 15) {
    description = "Swing trading (quelques semaines)";
  } else if (target <= 40) {
    description = "Position trading (1-2 mois)";
  } else {
    description = "Trend following (moyen terme)";
  }

  return {
    min: Math.max(1, min),
    max: Math.max(2, max),
    target: Math.max(1, target),
    description,
  };
}
