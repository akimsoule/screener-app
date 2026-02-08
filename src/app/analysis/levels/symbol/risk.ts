import type {
  OHLC,
  RiskConfig,
  MacroRegime,
  RiskAssessment,
} from "../../types";
import { REGIME_THRESHOLDS, ASSET_PATTERNS } from "../../constants";
import { DEFAULT_RISK_CONFIG, getVixValue } from "./utils";

/**
 * Évalue le risque d'un trade (filtres critiques + ajustement sizing)
 */
export async function assessRisk(
  symbol: string,
  price: number,
  atr: number,
  score: number,
  opts?: { config?: RiskConfig; macroRegime?: MacroRegime; lastCandle?: OHLC },
): Promise<RiskAssessment> {
  const config = opts?.config || DEFAULT_RISK_CONFIG;
  const macroRegime = opts?.macroRegime;
  const lastCandle = opts?.lastCandle;

  const flags: string[] = [];
  let riskPercent = config.maxRiskPerTrade;
  let approved = true;

  // ✅ Filtre 0 : Fraîcheur des données
  if (lastCandle) {
    const candleAge = Date.now() - new Date(lastCandle.date).getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 jours
    if (candleAge > maxAge) {
      flags.push(
        `DONNEES_OBSOLETES (${Math.floor(candleAge / (24 * 60 * 60 * 1000))} jours)`,
      );
      approved = false;
    }
  }

  // ✅ Filtre 1 : VIX trop élevé → marché irrationnel
  const vix = await getVixValue(config);
  if (vix > 0 && vix > config.vixThreshold) {
    flags.push(`VIX_ELEVE (${vix.toFixed(1)} > ${config.vixThreshold})`);
    riskPercent *= 0.5;
  }

  // ✅ Filtre 2 : Volatilité excessive (ATR > 3% du prix)
  const atrPercent = (atr / price) * 100;
  if (atrPercent > REGIME_THRESHOLDS.ATR_PERCENT_EXTREME) {
    flags.push(`VOLATILITE_EXCESSIVE (${atrPercent.toFixed(1)}%)`);
    riskPercent *= 0.7;
  }

  // 🔴 FILTRE CRITIQUE : Or + dollar strengthening = refuser trade
  const upper = symbol.toUpperCase();
  const isGold =
    upper.includes("GC") || upper.includes("XAU") || upper.includes("GLD");
  if (isGold && macroRegime?.dollarRegime === "STRENGTHENING") {
    flags.push("OR_DOLLAR_CONFLICT (DXY strengthening → or bearish)");
    approved = false;
  }

  // 🔴 FILTRE : Late cycle + crypto = réduire exposition
  const isCrypto = ASSET_PATTERNS.CRYPTO.some((x) => upper.includes(x));
  if (isCrypto && macroRegime?.cycleStage === "LATE_CYCLE") {
    flags.push("LATE_CYCLE_CRYPTO_RISK");
    riskPercent *= 0.4;
  }

  // ✅ Filtre 3 : Confiance minimale
  if (Math.abs(score) < config.minConfidence) {
    flags.push(`CONFIANCE_INSUFFISANTE (score: ${score})`);
    approved = false;
  }

  return {
    approved,
    flags,
    adjustedRiskPercent: riskPercent,
  };
}
