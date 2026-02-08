import { MacroRegime } from "../types";

/**
 * NIVEAU D'ANALYSE : MACRO
 * Détecte le régime macro sans subjectivité
 * Basé sur les signaux quantifiés :
 * - Position Fed vs marché (dot plot vs futures)
 * - Momentum ISM PMI (cycle business)
 * - Momentum dollar (DXY)
 * - Momentum liquidité (M2 YoY)
 */

function computeSignals(marketData: {
  fedDotPlot2025: number;
  marketPricing2025: number;
  ismPmi: number;
  dxyMomentum: number;
  m2Growth: number;
  nfpSurprise: number;
}) {
  const signals = { riskOn: 0, riskOff: 0 };

  // 🔸 Signal 1 : Politique Fed (le cœur de l'analyse de Liot)
  const fedEasing =
    marketData.marketPricing2025 < marketData.fedDotPlot2025 - 0.25;
  if (fedEasing) signals.riskOn += 30; // Marché pricé + cuts que la Fed → liquidity bullish

  // 🔸 Signal 2 : ISM PMI (cycle business)
  if (marketData.ismPmi > 52) signals.riskOn += 25;
  else if (marketData.ismPmi < 48) signals.riskOff += 25;

  // 🔸 Signal 3 : Dollar (asymétrie haussière identifiée par Liot)
  if (marketData.dxyMomentum > 2) signals.riskOff += 15;
  else if (marketData.dxyMomentum < -5) signals.riskOn += 10;

  // 🔸 Signal 4 : Liquidité M2
  if (marketData.m2Growth > 5) signals.riskOn += 20;

  // 🔸 Signal 5 : NFP (forward-looking mechanism de Liot)
  if (marketData.nfpSurprise > 50000) signals.riskOff += 15;

  const score = signals.riskOn - signals.riskOff;
  return { signals, fedEasing, score };
}

export function detectMacroRegime(marketData: {
  fedDotPlot2025: number; // ex: 3.75%
  marketPricing2025: number; // ex: 3.70%
  ismPmi: number; // >50 = expansion
  dxyMomentum: number; // % change 3m
  m2Growth: number; // YoY %
  nfpSurprise: number; // actuel - prévu
}): MacroRegime {
  const { fedEasing, score } = computeSignals(marketData);

  // Compute phase explicitly to avoid nested ternaries
  let phase: MacroRegime["phase"] = "TRANSITION";
  if (score > 15) phase = "RISK_ON";
  else if (score < -15) phase = "RISK_OFF";

  // 🔸 Détection fin de cycle (insight clé de Liot sur Bitcoin)
  const lateCycleA = marketData.ismPmi > 60; // very high PMI
  const lateCycleB = marketData.m2Growth > 8; // excessive liquidity
  const lateCycleC = marketData.dxyMomentum < -8; // very weak dollar
  const lateCycleSignals = [lateCycleA, lateCycleB, lateCycleC].filter(
    Boolean,
  ).length;

  let cycleStage: MacroRegime["cycleStage"];
  if (lateCycleSignals >= 2) cycleStage = "LATE_CYCLE";
  else if (marketData.ismPmi > 52) cycleStage = "MID_CYCLE";
  else cycleStage = "EARLY_CYCLE";

  // Dollar regime
  let dollarRegime: MacroRegime["dollarRegime"];
  if (marketData.dxyMomentum > 2) dollarRegime = "STRENGTHENING";
  else if (marketData.dxyMomentum < -5) dollarRegime = "WEAK";
  else dollarRegime = "NEUTRAL";

  // Liquidity
  const liquidity = marketData.m2Growth > 5 ? "EXPANDING" : "NEUTRAL";

  return {
    phase,
    cycleStage,
    fedPolicy: fedEasing ? "CUTTING" : "PAUSING",
    dollarRegime,
    liquidity,
    confidence: Math.abs(score) * 2,
  };
}
