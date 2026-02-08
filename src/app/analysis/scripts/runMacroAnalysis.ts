#!/usr/bin/env tsx

/**
 * SCRIPT D'ANALYSE MACRO EN TEMPS RÉEL
 * Récupère et analyse les données macroéconomiques depuis FRED API + Yahoo Finance
 *
 * Usage:
 *   npm run dev src/app/analysis/scripts/runMacroAnalysis.ts
 *   tsx src/app/analysis/scripts/runMacroAnalysis.ts
 */

import { analyzeMacroContextWithRealData } from "../index.js";
import { logger, getErrorMessage } from "../../lib/logger.js";

async function main() {
  logger.info("\n🌍 ANALYSE MACRO EN TEMPS RÉEL\n");
  logger.info("═".repeat(60));

  try {
    const result = await analyzeMacroContextWithRealData();

    logger.info("\n📊 RÉGIME MACRO DÉTECTÉ");
    logger.info("─".repeat(60));
    logger.info(`Phase           : ${result.regime.phase}`);
    logger.info(`Cycle           : ${result.regime.cycleStage}`);
    logger.info(`Politique Fed   : ${result.regime.fedPolicy}`);
    logger.info(`Confiance       : ${(result.confidence * 100).toFixed(1)}%`);

    logger.info("\n💰 BIAIS PAR CLASSE D'ACTIFS");
    logger.info("─".repeat(60));
    logger.info(`Actions         : ${result.assetBias.equities.toFixed(2)}`);
    logger.info(`Crypto          : ${result.assetBias.crypto.toFixed(2)}`);
    logger.info(`Obligations     : ${result.assetBias.bonds.toFixed(2)}`);
    logger.info(`Matières 1ères  : ${result.assetBias.commodities.toFixed(2)}`);
    logger.info(`Forex (USD)     : ${result.assetBias.forex.toFixed(2)}`);

    logger.info("\n💡 INSIGHTS");
    logger.info("─".repeat(60));
    result.insights.forEach((insight) => logger.info(`  ${insight}`));

    if (result.metadata) {
      logger.info("\n🔍 MÉTADONNÉES");
      logger.info("─".repeat(60));
      logger.info(`Source          : ${result.metadata.source}`);
      logger.info(
        `FRED API        : ${result.metadata.fredApiAvailable ? "✅ Disponible" : "❌ Non configurée"}`,
      );
      logger.info(
        `Timestamp       : ${new Date(result.metadata.timestamp).toLocaleString("fr-FR")}`,
      );

      if (result.metadata.note) {
        logger.info(`Note            : ${result.metadata.note}`);
      }

      if (result.metadata.vix !== undefined) {
        logger.info(`\nDonnées marché :`);
        logger.info(`  VIX           : ${result.metadata.vix.toFixed(2)}`);
        logger.info(
          `  S&P 500 (1j)  : ${result.metadata.spyChange >= 0 ? "+" : ""}${result.metadata.spyChange.toFixed(2)}%`,
        );
        logger.info(
          `  Or (1j)       : ${result.metadata.goldChange >= 0 ? "+" : ""}${result.metadata.goldChange.toFixed(2)}%`,
        );
        if (result.metadata.fedFundsRate) {
          logger.info(
            `  Fed Funds     : ${result.metadata.fedFundsRate.toFixed(2)}%`,
          );
        }
      }

      if (result.metadata.fearGreed) {
        logger.info(`\n🎭 Fear & Greed Index (Crypto) :`);
        logger.info(`  Score         : ${result.metadata.fearGreed.value}/100`);
        logger.info(
          `  Classification: ${result.metadata.fearGreed.classification}`,
        );
        logger.info(
          `  Interprétation: ${result.metadata.fearGreed.interpretation}`,
        );
      }
    }

    logger.info("\n" + "═".repeat(60));
    logger.info("✅ Analyse macro terminée avec succès\n");
    process.exit(0);
  } catch (error) {
    logger.error("\n❌ ERREUR:", getErrorMessage(error));
    process.exit(1);
  }
}

main();
