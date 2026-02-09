#!/usr/bin/env tsx
import "dotenv/config";
import { prisma } from "../src/app/lib/prisma";
import { filterService } from "../src/app/analysis/services/filterService";
import { analysisService } from "../src/app/analysis/services/analysisService";
import { analyzeMacroContextWithRealData } from "../src/app/analysis/services/macroService";
import { logger } from "../src/app/lib/logger.js";

/**
 * SCRIPT SCREENER - TEST DU SERVICE DE SCREENING
 *
 * Teste le filtrage et l'analyse incrémentale des symboles
 * selon différents critères (secteur, dividendes, score, etc.)
 *
 * Usage:
 *   tsx src/app/analysis/scripts/runScreener.ts
 *   npm run screener
 */

async function main() {
  try {
    console.log("🔍 SCREENER - DÉBUT DU SCAN\n");

    // 1. Contexte macro
    console.log("📊 Analyse du contexte macroéconomique...");
    const macroContext = await analyzeMacroContextWithRealData();
    console.log(
      `✅ Régime: ${macroContext.regime.cycleStage} (confiance: ${(macroContext.confidence * 100).toFixed(0)}%)`,
    );
    console.log(`   Phase: ${macroContext.regime.phase}`);
    console.log(`   Liquidité: ${macroContext.regime.liquidity}`);
    console.log(`   Dollar: ${macroContext.regime.dollarRegime}\n`);

    // 2. Statistiques globales
    console.log("📈 Statistiques du screener:");
    const availableFilters = await filterService.getAvailableFilters();
    const totalSymbols = await prisma.symbol.count({
      where: { enabled: true },
    });
    console.log(`   Total symboles actifs: ${totalSymbols}`);
    console.log(
      `   Secteurs disponibles: ${availableFilters.booleanFilters.sector.length}`,
    );
    console.log(
      `   Industries disponibles: ${availableFilters.booleanFilters.industry.length}\n`,
    );

    // 3. Filtres de démonstration
    const filters = [
      {
        name: "🎯 TOP TECH (Score > 60)",
        criteria: {
          sector: ["Technology"],
          scoreMin: 60,
        },
      },
      {
        name: "💎 DIVIDENDES ÉLEVÉS (> 3%)",
        criteria: {
          dividendYieldMin: 0.03,
        },
      },
      {
        name: "🚀 STRONG BUY",
        criteria: {
          action: ["STRONG_BUY"],
        },
      },
      {
        name: "📉 STRONG SELL",
        criteria: {
          action: ["STRONG_SELL"],
        },
      },
    ];

    // 4. Analyse avec chaque filtre
    for (const filter of filters) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(filter.name);
      console.log("=".repeat(80));

      try {
        // Récupérer les symboles filtrés
        const symbols = await filterService.filterSymbols(filter.criteria);
        console.log(
          `📊 ${symbols.length} symboles trouvés (affichage des ${Math.min(10, symbols.length)} premiers)\n`,
        );

        if (symbols.length === 0) {
          console.log("   Aucun symbole ne correspond aux critères.\n");
          continue;
        }

        // Analyser les 3 premiers
        const toAnalyze = symbols.slice(0, 3);
        console.log(`🔬 Analyse des ${toAnalyze.length} meilleurs symboles:\n`);

        for (const symbol of toAnalyze) {
          try {
            const report = await analysisService.analyzeSymbol(symbol.name, {
              riskConfig: { accountSize: 100000, riskPercentPerTrade: 1 },
            });

            console.log(
              `   ${symbol.name.padEnd(12)} | ${report.action.padEnd(18)} | Score: ${report.score.toString().padStart(3)} | Prix: ${report.details.price.toFixed(2).padStart(8)} $`,
            );

            if (report.recommendation.hourlyTiming) {
              console.log(
                `                 └─ Timing hourly: ${report.recommendation.hourlyTiming.recommendation}`,
              );
            }

            if (
              report.recommendation.side === "LONG" ||
              report.recommendation.side === "SHORT"
            ) {
              console.log(
                `                 └─ Entry: ${report.recommendation.entry.toFixed(2)} $ | SL: ${report.recommendation.stopLoss.toFixed(2)} $ | TP: ${report.recommendation.takeProfit.toFixed(2)} $ | RR: ${report.recommendation.riskReward}:1`,
              );
            } else {
              console.log(
                `                 └─ ⚠️ Trade non recommandé: ${report.recommendation.rationale}`,
              );
            }
          } catch (error) {
            console.log(
              `   ${symbol.name.padEnd(12)} | ❌ Erreur: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Afficher les autres symboles sans analyse détaillée
        if (symbols.length > 3) {
          console.log(`\n   Autres symboles (sans analyse):)`);
          symbols.slice(3).forEach((s) => {
            const meta = s.metadata as Record<string, any>;
            const sector = meta?.data?.sector || "N/A";
            console.log(`   - ${s.name.padEnd(12)} | ${sector}`);
          });
        }
      } catch (error) {
        console.error(
          `   ❌ Erreur lors du filtrage: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // 5. Résumé final
    console.log(`\n${"=".repeat(80)}`);
    console.log("✅ SCREENER - FIN DU SCAN");
    console.log("=".repeat(80));
    console.log(
      `\n💡 Pour filtrer avec des critères personnalisés, utilisez filterService.filterSymbols()`,
    );
    console.log(`   Exemples de filtres:`);
    console.log(`   - { sector: ["Technology", "Healthcare"] }`);
    console.log(`   - { dividendYieldMin: 0.02, dividendYieldMax: 0.05 }`);
    console.log(`   - { scoreMin: 60, action: ["STRONG_BUY", "BUY"] }`);
    console.log(
      `   - { peRatioMin: 10, peRatioMax: 20, marketCapMin: 1000000000 }\n`,
    );
  } catch (error) {
    logger.error("❌ Erreur fatale:", error);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
