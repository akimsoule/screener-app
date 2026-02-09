#!/usr/bin/env tsx
import "dotenv/config";
import { filterService } from "../analysis/services/filterService.js";
import { logger } from "../lib/logger.js";

/**
 * SCRIPT D'AFFICHAGE DES FILTRES DISPONIBLES
 * Affiche les options de filtrage basées sur les métadonnées en base
 *
 * Usage:
 *   tsx src/app/analysis/scripts/displayFilters.ts
 */

async function displayFilters() {
  logger.info("🔍 Affichage des filtres disponibles...");

  try {
    // Statistiques générales
    console.log("\n📊 STATISTIQUES GÉNÉRALES");
    console.log("=".repeat(50));

    const stats = await filterService.getSymbolStats();
    console.log("Répartition des symboles :");
    Object.entries(stats)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, count]) => {
        console.log(`  ${key}: ${count}`);
      });

    // Valeurs distinctes pour chaque filtre
    console.log("\n🎯 VALEURS DISTINCTES PAR FILTRE");
    console.log("=".repeat(50));

    const filterFields = [
      "exchange",
      "sector",
      "industry",
      "quoteCurrency",
    ] as const;

    for (const field of filterFields) {
      try {
        const values = await filterService.getDistinctMetadataValues(field);
        console.log(`\n${field.toUpperCase()} (${values.length} valeurs) :`);
        if (values.length > 0) {
          // Afficher par groupes de 5 pour la lisibilité
          for (let i = 0; i < values.length; i += 5) {
            const chunk = values.slice(i, i + 5);
            console.log(`  ${chunk.join(", ")}`);
          }
        } else {
          console.log("  (aucune valeur trouvée)");
        }
      } catch (error) {
        console.log(`❌ Erreur récupération ${field}:`, error);
      }
    }

    // Exemples d'utilisation
    console.log("\n💡 EXEMPLES D'UTILISATION");
    console.log("=".repeat(50));

    // Symboles populaires
    console.log("\n⭐ SYMBOLES POPULAIRES :");
    const popular = await filterService.getPopularSymbols();
    console.log(`  ${popular.length} symboles populaires trouvés`);
    popular.slice(0, 10).forEach((s) => {
      console.log(`    - ${s.name} (${s.symbolType})`);
    });

    // Cryptos
    console.log("\n₿ CRYPTOMONNAIES :");
    const cryptos = await filterService.getCryptoSymbols();
    console.log(`  ${cryptos.length} cryptos trouvées`);
    cryptos.slice(0, 5).forEach((s) => {
      const metadata = s.metadata as any;
      console.log(
        `    - ${s.name} (${metadata?.data?.quoteCurrency || "N/A"})`,
      );
    });

    // Actions par secteur (si disponibles)
    try {
      const sectors = await filterService.getDistinctMetadataValues("sector");
      if (sectors.length > 0) {
        console.log(`\n🏢 ACTIONS PAR SECTEUR (${sectors[0]}) :`);
        const stocksBySector = await filterService.getStocksBySector(
          sectors[0],
        );
        console.log(`  ${stocksBySector.length} actions trouvées`);
        stocksBySector.slice(0, 5).forEach((s) => {
          console.log(`    - ${s.name}`);
        });
      }
    } catch (error) {
      console.log("❌ Erreur récupération secteur:", error);
    }

    // Recherche exemple
    console.log("\n🔍 RECHERCHE 'AAPL' :");
    const searchResults = await filterService.searchSymbols("AAPL", 5);
    console.log(`  ${searchResults.length} résultats trouvés`);
    searchResults.forEach((s) => {
      console.log(`    - ${s.name} (${s.symbolType})`);
    });

    // Statistiques sur les dividendes
    console.log("\n💰 STATISTIQUES DIVIDENDES :");
    const dividendStats = await filterService.getDividendStats();
    console.log(`  Total actions: ${dividendStats.total}`);
    console.log(`  Avec dividendes: ${dividendStats.withDividend}`);
    console.log(`  Sans dividendes: ${dividendStats.withoutDividend}`);
    if (
      dividendStats.withDividend > 0 &&
      dividendStats.averageYield !== undefined
    ) {
      console.log(
        `  Rendement moyen: ${(dividendStats.averageYield * 100).toFixed(2)}%`,
      );
      console.log(
        `  Rendement médian: ${((dividendStats.medianYield ?? 0) * 100).toFixed(2)}%`,
      );
      console.log(
        `  Rendement min: ${((dividendStats.minYield ?? 0) * 100).toFixed(2)}%`,
      );
      console.log(
        `  Rendement max: ${((dividendStats.maxYield ?? 0) * 100).toFixed(2)}%`,
      );
    }

    // Actions à dividendes avec rendement > 2%
    console.log("\n💎 ACTIONS À DIVIDENDES (>2%) :");
    const highDividendStocks = await filterService.getStocksWithDividends(0.02);
    console.log(`  ${highDividendStocks.length} actions trouvées`);
    highDividendStocks.slice(0, 5).forEach((s) => {
      const metadata = s.metadata as any;
      const yieldStr = metadata?.data?.dividendYield || "0";
      const yieldValue = Number.parseFloat(yieldStr) * 100;
      console.log(`    - ${s.name}: ${yieldValue.toFixed(2)}%`);
    });

    logger.info("✅ Affichage terminé");
  } catch (error) {
    logger.error("❌ Erreur lors de l'affichage des filtres:", error);
    process.exit(1);
  }
}

try {
  await displayFilters();
  process.exit(0);
} catch (error) {
  console.error("Erreur fatale:", error);
  process.exit(1);
}
