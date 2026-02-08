import { detectMacroRegime } from "../levels/levelMacro";
import { calculateAssetClassBias } from "../levels/levelAssetClass";
import { fetchRealMacroData } from "./macroDataService.js";
import type { MacroRegime, AssetClassBias } from "../types";

/**
 * SERVICE MACRO - COUCHE MÉTIER
 * Service spécialisé pour la détection et l'analyse macro
 *
 * Responsabilités :
 * - Détection du régime macro
 * - Calcul des biais sectoriels
 * - Enrichissement des données macro
 */

export interface MacroContextInput {
  fedDotPlot2025: number;
  marketPricing2025: number;
  ismPmi: number;
  dxyMomentum: number;
  m2Growth: number;
  nfpSurprise: number;
}

export interface MacroAnalysisResult {
  regime: MacroRegime;
  assetBias: AssetClassBias;
  insights: string[];
  confidence: number;
  metadata?: {
    source: string;
    timestamp: string;
    [key: string]: any;
  };
}

/**
 * Récupère et analyse les données macro en temps réel
 */
export async function analyzeMacroContextWithRealData(): Promise<MacroAnalysisResult> {
  // Récupération des données réelles
  const { _metadata, ...marketData } = await fetchRealMacroData();

  // Analyse macro
  const result = analyzeMacroContext(marketData);

  // Enrichissement des insights avec Fear & Greed si disponible
  const enrichedInsights = [...result.insights];

  if (_metadata?.fearGreed) {
    const fg = _metadata.fearGreed;
    if (fg.value < 25) {
      enrichedInsights.push(
        `🎭 EXTREME FEAR (${fg.value}/100) : Capitulation possible, opportunité d'accumulation`,
      );
    } else if (fg.value > 75) {
      enrichedInsights.push(
        `🎭 EXTREME GREED (${fg.value}/100) : Euphorie excessive, réduire exposition crypto`,
      );
    } else if (fg.value < 45) {
      enrichedInsights.push(
        `🎭 Fear & Greed: ${fg.classification} (${fg.value}/100) - Sentiment baissier modéré`,
      );
    } else if (fg.value > 55) {
      enrichedInsights.push(
        `🎭 Fear & Greed: ${fg.classification} (${fg.value}/100) - Sentiment haussier modéré`,
      );
    }
  }

  // Ajout des métadonnées
  return {
    ...result,
    insights: enrichedInsights,
    metadata: _metadata,
  };
}

/**
 * Analyse macro complète
 */
export function analyzeMacroContext(
  marketData: MacroContextInput,
): MacroAnalysisResult {
  // Détection du régime
  const regime = detectMacroRegime(marketData);

  // Calcul des biais sectoriels
  const assetBias = calculateAssetClassBias(regime);

  // Génération des insights
  const insights = generateMacroInsights(regime, assetBias);

  return {
    regime,
    assetBias,
    insights,
    confidence: regime.confidence,
  };
}

/**
 * Génère des insights textuels à partir du régime macro
 */
function generateMacroInsights(
  regime: MacroRegime,
  assetBias: AssetClassBias,
): string[] {
  const insights: string[] = [];

  // Phase macro
  if (regime.phase === "RISK_ON") {
    insights.push(
      "📈 Environnement RISK-ON détecté : favorable aux actifs risqués (actions, crypto)",
    );
  } else if (regime.phase === "RISK_OFF") {
    insights.push(
      "📉 Environnement RISK-OFF détecté : privilégier la sécurité (obligations, cash)",
    );
  } else {
    insights.push(
      "⚖️ Phase de TRANSITION : signaux mixtes, prudence recommandée",
    );
  }

  // Cycle économique
  if (regime.cycleStage === "LATE_CYCLE") {
    insights.push(
      "⚠️ LATE CYCLE : fin de cycle détectée, considérer une réduction progressive des positions risquées",
    );
  } else if (regime.cycleStage === "EARLY_CYCLE") {
    insights.push(
      "🌱 EARLY CYCLE : début de cycle, opportunités d'accumulation",
    );
  } else {
    insights.push(
      "📊 MID CYCLE : expansion en cours, maintenir l'exposition au marché",
    );
  }

  // Politique Fed
  if (regime.fedPolicy === "CUTTING") {
    insights.push(
      "💰 Fed en mode CUTTING : liquidité favorable, support haussier",
    );
  } else {
    insights.push(
      "🏦 Fed en mode PAUSING : politique monétaire stable, environnement neutre",
    );
  }

  // Dollar
  if (regime.dollarRegime === "STRENGTHENING") {
    insights.push(
      "💵 Dollar en renforcement : pression sur commodities et actifs émergents",
    );
  } else if (regime.dollarRegime === "WEAK") {
    insights.push("💸 Dollar faible : favorable aux commodities, or et crypto");
  }

  // Liquidité
  if (regime.liquidity === "EXPANDING") {
    insights.push(
      "💧 Liquidité en expansion : support structurel pour les actifs risqués",
    );
  }

  // Recommandations sectorielles basées sur les biais
  const topBias = Object.entries(assetBias)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2);

  if (topBias.length > 0) {
    const topAsset = topBias[0][0];
    const topScore = topBias[0][1];
    if (topScore > 20) {
      insights.push(
        `🎯 Biais sectoriel fort : ${translateAssetClass(topAsset)} (score: +${topScore})`,
      );
    }
  }

  return insights;
}

function translateAssetClass(assetClass: string): string {
  const translations: Record<string, string> = {
    equities: "Actions",
    bonds: "Obligations",
    commodities: "Matières premières",
    crypto: "Cryptomonnaies",
    forex: "Devises",
  };
  return translations[assetClass] || assetClass;
}

/**
 * Détermine si le contexte macro est favorable pour un type d'actif
 */
export function isMacroFavorableFor(
  assetClass: keyof AssetClassBias,
  macroAnalysis: MacroAnalysisResult,
): boolean {
  return macroAnalysis.assetBias[assetClass] > 10; // Seuil de biais favorable
}
