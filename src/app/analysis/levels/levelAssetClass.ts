import { AssetClassBias, MacroRegime } from "../types";

/**
 * NIVEAU D'ANALYSE : ASSET CLASS
 * Applique les biais sectoriels selon le régime macro
 * Inspiré de l'analyse de Liot mais formalisé :
 * - Risk-on + Fed cutting → equities/crypto bullish
 * - Late cycle → réduire crypto, augmenter bonds
 * - Dollar weak → commodities/crypto bullish
 */

export function calculateAssetClassBias(regime: MacroRegime): AssetClassBias {
  const bias: AssetClassBias = {
    equities: 0,
    bonds: 0,
    commodities: 0,
    crypto: 0,
    forex: 0,
  };

  // 🔸 Règle 1 : Phase risk-on/off (le driver principal de Liot)
  if (regime.phase === "RISK_ON") {
    bias.equities += 15;
    bias.crypto += 20;
    bias.commodities += 10;
    bias.bonds -= 5; // yields baissiers mais moins attractif que risk assets
  } else if (regime.phase === "RISK_OFF") {
    bias.bonds += 25;
    bias.equities -= 15;
    bias.crypto -= 25;
  }

  // 🔸 Règle 2 : Cycle avancé (insight CRUCIAL de Liot sur fin de bull run)
  if (regime.cycleStage === "LATE_CYCLE") {
    bias.crypto -= 30; // Réduire exposition crypto en fin de cycle 4 ans
    bias.equities -= 10;
    bias.bonds += 15; // Se positionner sur obligations avant retournement
  }

  // 🔸 Règle 3 : Régime dollar (asymétrie identifiée par Liot)
  if (regime.dollarRegime === "WEAK") {
    bias.commodities += 15; // Or/argent bénéficient d'un dollar faible
    bias.crypto += 10;
  } else if (regime.dollarRegime === "STRENGTHENING") {
    bias.forex += 20; // Bullish USD
    bias.commodities -= 10;
  }

  // 🔸 Règle 4 : Saisonnalité crypto (October pump de Liot)
  const now = new Date();
  if (now.getMonth() === 9 && now.getDate() >= 1 && now.getDate() <= 31) {
    // Octobre
    bias.crypto += 10; // Saisonnlité historiquement forte
  }

  // 🔸 Règle 5 : Liquidité excessive = bulle potentielle
  if (regime.liquidity === "EXPANDING" && regime.cycleStage === "LATE_CYCLE") {
    bias.crypto -= 15; // Liquidité + late cycle = risque de blow-off top
  }

  return bias;
}
