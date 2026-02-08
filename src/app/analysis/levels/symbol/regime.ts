import { ADX, ATR, SMA } from "technicalindicators";
import type { OHLC, Regime } from "../../types";
import { INDICATOR_PERIODS, REGIME_THRESHOLDS } from "../../constants";

/**
 * Détecte le régime de marché (tendance forte, faible, range, chop)
 */
export function detectRegime(ohlc: OHLC[]): Regime {
  const closes = ohlc.map((o) => o.close);
  const highs = ohlc.map((o) => o.high);
  const lows = ohlc.map((o) => o.low);

  // ADX pour force de tendance
  const adxResult = ADX.calculate({
    period: INDICATOR_PERIODS.ADX,
    high: highs,
    low: lows,
    close: closes,
  });
  const adx = adxResult.at(-1)!.adx;

  // Volatilité relative
  const atr = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: INDICATOR_PERIODS.ATR_SHORT,
  }).at(-1)!;
  const atrPercent = (atr / closes.at(-1)!) * 100;

  // Pente SMA50 (en %)
  const sma50 = SMA.calculate({
    values: closes,
    period: INDICATOR_PERIODS.SMA_SHORT,
  });
  const slope = ((sma50.at(-1)! - sma50.at(-10)!) / sma50.at(-10)!) * 100;

  if (
    adx > REGIME_THRESHOLDS.ADX_STRONG_TREND &&
    Math.abs(slope) > REGIME_THRESHOLDS.SLOPE_STRONG
  )
    return "STRONG_TREND";
  if (
    adx > REGIME_THRESHOLDS.ADX_WEAK_TREND &&
    Math.abs(slope) > REGIME_THRESHOLDS.SLOPE_WEAK
  )
    return "WEAK_TREND";
  if (
    adx < REGIME_THRESHOLDS.ADX_RANGE ||
    atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_HIGH
  )
    return "CHOP"; // marché bruyant
  return "RANGE";
}
