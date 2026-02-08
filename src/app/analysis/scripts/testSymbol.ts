#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../../lib/prisma";
import { analysisService } from "../services/analysisService";
import { analyzeMacroContextWithRealData } from "../services/macroService";
import { logger } from "../../lib/logger.js";

/**
 * SCRIPT TEST SYMBOLE - ANALYSE RAPIDE D'UN SYMBOLE SPÉCIFIQUE
 *
 * Permet de tester rapidement l'analyse d'un symbole donné
 * avec affichage détaillé des résultats
 *
 * Usage:
 *   tsx src/app/analysis/scripts/testSymbol.ts AAPL
 *   tsx src/app/analysis/scripts/testSymbol.ts BTC-USD
 *   npm run test:symbol -- NVDA
 */

const SYMBOL = process.argv[2] || "AAPL";

async function main() {
  try {
    console.log("=".repeat(80));
    console.log(`🔬 ANALYSE DU SYMBOLE: ${SYMBOL}`);
    console.log("=".repeat(80));

    // 1. Vérifier si le symbole existe en DB
    console.log("\n📂 Vérification en base de données...");
    const dbSymbol = await prisma.symbol.findFirst({
      where: { name: SYMBOL, enabled: true },
    });

    if (dbSymbol) {
      console.log(
        `✅ Symbole trouvé en DB: ${dbSymbol.name} (${dbSymbol.symbolType})`,
      );
      const meta = dbSymbol.metadata as any;
      if (meta?.data) {
        console.log(`   Secteur: ${meta.data.sector || "N/A"}`);
        console.log(`   Industrie: ${meta.data.industry || "N/A"}`);
        console.log(`   Exchange: ${meta.data.exchange || "N/A"}`);
      }
    } else {
      console.log(`⚠️ Symbole non trouvé en DB (analyse directe)`);
    }

    // 2. Contexte macro
    console.log("\n📊 Récupération du contexte macroéconomique...");
    const macroContext = await analyzeMacroContextWithRealData();
    console.log(`✅ Régime macro: ${macroContext.regime.cycleStage}`);
    console.log(`   Confiance: ${(macroContext.confidence * 100).toFixed(1)}%`);
    console.log(`   Phase: ${macroContext.regime.phase}`);
    console.log(`   Liquidité: ${macroContext.regime.liquidity}`);
    console.log(`   Dollar: ${macroContext.regime.dollarRegime}`);

    // 3. Analyse technique
    console.log("\n🔬 Lancement de l'analyse technique...");
    const startTime = Date.now();

    const report = await analysisService.analyzeSymbol(SYMBOL, {
      riskConfig: {
        accountSize: 100000,
        riskPercentPerTrade: 1,
        kellyFraction: 0.25,
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Analyse terminée en ${duration}s\n`);

    // 4. Affichage des résultats
    console.log("=".repeat(80));
    console.log("📊 RÉSULTATS DE L'ANALYSE");
    console.log("=".repeat(80));

    console.log(`\n📈 Score & Action:`);
    console.log(`   ${report.action}`);
    console.log(`   Score brut: ${report.rawScore}`);
    console.log(`   Score normalisé: ${report.score}/100`);
    console.log(`   Confiance: ${report.confidence}%`);
    if (report.liotBias) {
      console.log(
        `   Biais LIOT (macro): ${report.liotBias > 0 ? "+" : ""}${report.liotBias}`,
      );
    }

    console.log(`\n📊 Détails techniques:`);
    console.log(`   Prix: ${report.details.price.toFixed(2)} $`);
    console.log(`   RSI: ${report.details.rsi.toFixed(2)}`);
    console.log(`   ADX: ${report.details.adx.toFixed(2)}`);
    console.log(
      `   ATR: ${report.details.atr.toFixed(2)} $ (${report.details.atrPercent.toFixed(2)}%)`,
    );
    console.log(`   Tendance Daily: ${report.details.trendDaily}`);
    console.log(`   Tendance Weekly: ${report.details.trendWeekly}`);
    console.log(`   Régime: ${report.regime}`);
    console.log(`   Volatilité: ${report.details.volatilityRegime}`);

    console.log(`\n💡 Interprétation:`);
    report.interpretation.split("\n").forEach((line) => {
      console.log(`   ${line}`);
    });

    if (report.riskFlags.length > 0) {
      console.log(`\n⚠️ Drapeaux de risque:`);
      report.riskFlags.forEach((flag) => {
        console.log(`   - ${flag}`);
      });
    }

    // 5. Recommandation
    console.log(`\n${"=".repeat(80)}`);
    console.log("💼 RECOMMANDATION DE TRADE");
    console.log("=".repeat(80));

    if (report.recommendation.side === "NONE") {
      console.log(`\n❌ Trade non recommandé`);
      console.log(`   Raison: ${report.recommendation.rationale}\n`);
    } else {
      console.log(`\n✅ Trade autorisé`);
      console.log(`   Côté: ${report.recommendation.side}`);
      console.log(`   Entry: ${report.recommendation.entry.toFixed(2)} $`);
      console.log(
        `   Stop Loss: ${report.recommendation.stopLoss.toFixed(2)} $ (${(((report.recommendation.stopLoss - report.recommendation.entry) / report.recommendation.entry) * 100).toFixed(2)}%)`,
      );
      console.log(
        `   Take Profit: ${report.recommendation.takeProfit.toFixed(2)} $ (${(((report.recommendation.takeProfit - report.recommendation.entry) / report.recommendation.entry) * 100).toFixed(2)}%)`,
      );
      console.log(`   Risk/Reward: ${report.recommendation.riskReward}:1`);

      // Position sizing (currently sizing is null - not implemented yet)
      // TODO: Implement position sizing calculation

      console.log(`\n⏱️ Holding Period:`);
      console.log(
        `   Période cible: ${report.recommendation.holdingPeriod.target} jours`,
      );
      console.log(
        `   Min - Max: ${report.recommendation.holdingPeriod.min} - ${report.recommendation.holdingPeriod.max} jours`,
      );
      console.log(
        `   Stratégie: ${report.recommendation.holdingPeriod.description}`,
      );

      if (report.recommendation.hourlyTiming) {
        console.log(`\n⏰ Timing Hourly:`);
        console.log(
          `   RSI 1h: ${report.recommendation.hourlyTiming.rsi.toFixed(2)}`,
        );
        console.log(
          `   Momentum: ${report.recommendation.hourlyTiming.momentum}`,
        );
        console.log(
          `   Near Support: ${report.recommendation.hourlyTiming.nearSupport}`,
        );
        console.log(
          `   Near Resistance: ${report.recommendation.hourlyTiming.nearResistance}`,
        );
        console.log(
          `   Recommandation: ${report.recommendation.hourlyTiming.recommendation}`,
        );
        if (report.recommendation.hourlyTiming.optimalEntry) {
          console.log(
            `   Entry optimale: ${report.recommendation.hourlyTiming.optimalEntry.toFixed(2)} $`,
          );
        }
      }

      console.log(`\n📊 Métriques estimées:`);
      console.log(`   Win Rate: ${report.metrics.winRateEstimate.toFixed(1)}%`);
      console.log(`   Espérance: ${report.metrics.expectancy.toFixed(2)}`);
      console.log(`   MAE: ${report.metrics.maxAdverseExcursion.toFixed(2)} $`);

      console.log(`\n💬 Rationale:`);
      console.log(`   ${report.recommendation.rationale}\n`);
    }

    // 6. Contexte macro (si disponible)
    if (report.macroContext) {
      console.log(`${"=".repeat(80)}`);
      console.log("🌍 CONTEXTE MACROÉCONOMIQUE");
      console.log("=".repeat(80));
      console.log(`   Régime: ${report.macroContext.cycleStage}`);
      console.log(`   Phase: ${report.macroContext.phase}`);
      console.log(`   Fed Policy: ${report.macroContext.fedPolicy}`);
      console.log(`   Liquidité: ${report.macroContext.liquidity}`);
      console.log(`   Dollar: ${report.macroContext.dollarRegime}\n`);
    }

    console.log("=".repeat(80));
    console.log("✅ ANALYSE TERMINÉE");
    console.log("=".repeat(80));
  } catch (error) {
    logger.error("❌ Erreur lors de l'analyse:", error);
    console.error(
      "\n❌ ERREUR:",
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
