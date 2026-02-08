import type { AnalysisReport, RiskConfig } from "../../types";
import { SCORE_NORMALIZATION, SCORE_THRESHOLDS } from "../../constants";
import { getMarketData } from "../../prices";

// =============== HELPER: Récupérer VIX ===============

export async function getVixValue(config: RiskConfig): Promise<number> {
  // @ts-ignore - vixValue peut être ajouté dynamiquement par le service
  if (config.vixValue !== undefined) {
    // @ts-ignore
    return config.vixValue;
  }

  // Fallback : récupérer VIX si pas fourni (cas analyse simple)
  const vixData = await getMarketData("^VIX");
  return (
    (vixData &&
    typeof vixData === "object" &&
    "price" in vixData &&
    typeof vixData.price === "number"
      ? vixData.price
      : 0) || 0
  );
}

// =============== CONFIGURATION PAR DÉFAUT ===============

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxRiskPerTrade: 0.01,
  maxPortfolioRisk: 0.06,
  maxPositions: 10,
  minConfidence: 40,
  maxCorrelation: 0.7,
  vixThreshold: 30,
  maxDrawdown: 0.15,
};

// =============== UTILS ===============

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const normalizeScore = (
  raw: number,
  maxAbs: number = SCORE_NORMALIZATION.MAX_ABS,
) => clamp(Math.round((raw / maxAbs) * 100), -100, 100);

export const scoreToAction = (score: number): AnalysisReport["action"] => {
  if (score >= SCORE_THRESHOLDS.STRONG_BUY) return "🟢 STRONG_BUY";
  if (score >= SCORE_THRESHOLDS.BUY) return "🔵 BUY";
  if (score <= SCORE_THRESHOLDS.STRONG_SELL) return "🔴 STRONG_SELL";
  if (score <= SCORE_THRESHOLDS.SELL) return "🟠 SELL";
  return "⚪ HOLD";
};

export const interpretScore = (score: number): string => {
  if (score >= SCORE_THRESHOLDS.STRONG_BUY)
    return "✅ Setup premium : tendance, momentum et structure alignés.";
  if (score >= SCORE_THRESHOLDS.BUY)
    return "📈 Setup favorable : biais positif avec risque contrôlé.";
  if (score > SCORE_THRESHOLDS.SELL)
    return "⏸ Zone neutre : absence d'edge statistique clair.";
  if (score > SCORE_THRESHOLDS.STRONG_SELL)
    return "📉 Marché fragile : momentum négatif, éviter les longs.";
  return "⚠️ Configuration défavorable : forte tendance baissière ou survente.";
};
