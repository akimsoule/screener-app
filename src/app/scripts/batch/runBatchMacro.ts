#!/usr/bin/env tsx
/**
 * Script batch d'analyse macro
 * Met à jour périodiquement l'analyse macroéconomique (toutes les heures)
 */

import "dotenv/config";
import { analyzeMacroContextWithRealData } from "../../analysis/index.js";
import { logger, getErrorMessage } from "../../lib/logger.js";

const MACRO_STALE_THRESHOLD_MINUTES = 60; // 1 heure

interface MacroBatchStats {
  wasUpdated: boolean;
  regimeChanged: boolean;
  previousRegime?: string;
  currentRegime: string;
  duration: number;
}

async function runMacroBatch(): Promise<MacroBatchStats> {
  const startTime = Date.now();

  console.log("\n" + "=".repeat(80));
  console.log("🌍 ANALYSE BATCH MACRO");
  console.log("=".repeat(80));

  try {
    // Appeler le service macro (le service gère sa propre cache)
    const result = await analyzeMacroContextWithRealData();

    const previousRegime = result.previousRegime;
    const wasUpdated = !result.fromCache;
    const regimeChanged = !!result.regimeChanged;

    if (!wasUpdated) {
      console.log(`✅ Analyse macro à jour (servie depuis le cache)`);

      // Afficher quand même les informations macro actuelles
      console.log(`\n📊 RÉGIME MACRO ACTUEL`);
      console.log("─".repeat(60));
      console.log(`Phase           : ${result.regime.phase}`);
      console.log(`Cycle           : ${result.regime.cycleStage}`);
      console.log(`Politique Fed   : ${result.regime.fedPolicy}`);
      console.log(`Confiance       : ${(result.confidence * 100).toFixed(1)}%`);

      console.log(`\n💰 BIAIS PAR CLASSE D'ACTIFS`);
      console.log("─".repeat(60));
      console.log(`Actions         : ${result.assetBias.equities.toFixed(2)}`);
      console.log(`Crypto          : ${result.assetBias.crypto.toFixed(2)}`);
      console.log(`Obligations     : ${result.assetBias.bonds.toFixed(2)}`);
      console.log(
        `Matières 1ères  : ${result.assetBias.commodities.toFixed(2)}`,
      );
      console.log(`Forex (USD)     : ${result.assetBias.forex.toFixed(2)}`);

      console.log(`\n💡 INSIGHTS`);
      console.log("─".repeat(60));
      result.insights.forEach((insight) => console.log(`  ${insight}`));

      if (result.metadata) {
        console.log(`\n🔍 MÉTADONNÉES`);
        console.log("─".repeat(60));
        console.log(`Source          : ${result.metadata.source}`);
        console.log(
          `Timestamp       : ${new Date(result.metadata.timestamp).toLocaleString("fr-FR")}`,
        );
      }

      return {
        wasUpdated: false,
        regimeChanged: false,
        currentRegime: `${result.regime.phase}/${result.regime.cycleStage}`,
        duration: Date.now() - startTime,
      };
    }

    console.log(`🔄 Mise à jour de l'analyse macro...`);

    const currentRegime = `${result.regime.phase}/${result.regime.cycleStage}`;

    // 3. Afficher les résultats
    console.log(`\n📊 RÉGIME MACRO MIS À JOUR`);
    console.log("─".repeat(60));
    console.log(`Phase           : ${result.regime.phase}`);
    console.log(`Cycle           : ${result.regime.cycleStage}`);
    console.log(`Politique Fed   : ${result.regime.fedPolicy}`);
    console.log(`Confiance       : ${(result.confidence * 100).toFixed(1)}%`);

    if (regimeChanged && previousRegime) {
      console.log(`\n🔄 CHANGEMENT DE RÉGIME:`);
      console.log(`   Avant: ${previousRegime}`);
      console.log(`   Après: ${currentRegime}`);

      // Log détaillé du changement
      logger.info("🔄 Changement de régime macro détecté", {
        previous: previousRegime,
        current: currentRegime,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`\n💰 BIAIS PAR CLASSE D'ACTIFS`);
    console.log("─".repeat(60));
    console.log(`Actions         : ${result.assetBias.equities.toFixed(2)}`);
    console.log(`Crypto          : ${result.assetBias.crypto.toFixed(2)}`);
    console.log(`Obligations     : ${result.assetBias.bonds.toFixed(2)}`);
    console.log(`Matières 1ères  : ${result.assetBias.commodities.toFixed(2)}`);
    console.log(`Forex (USD)     : ${result.assetBias.forex.toFixed(2)}`);

    console.log(`\n💡 INSIGHTS`);
    console.log("─".repeat(60));
    result.insights.forEach((insight) => console.log(`  ${insight}`));

    if (result.metadata) {
      console.log(`\n🔍 MÉTADONNÉES`);
      console.log("─".repeat(60));
      console.log(`Source          : ${result.metadata.source}`);
      console.log(
        `Timestamp       : ${new Date(result.metadata.timestamp).toLocaleString("fr-FR")}`,
      );
    }

    console.log(`\n✅ Analyse macro mise à jour avec succès`);

    return {
      wasUpdated,
      regimeChanged,
      previousRegime,
      currentRegime,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error(`❌ Erreur lors de l'analyse macro:`, errorMessage);

    logger.error("Erreur batch analyse macro", {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    throw error;
  }
}

// Fonction principale
async function main() {
  try {
    const stats = await runMacroBatch();

    console.log(`\n📈 STATISTIQUES BATCH MACRO`);
    console.log("─".repeat(40));
    console.log(`Mis à jour      : ${stats.wasUpdated ? "Oui" : "Non"}`);
    console.log(`Régime changé   : ${stats.regimeChanged ? "Oui" : "Non"}`);
    if (stats.previousRegime) {
      console.log(`Régime avant    : ${stats.previousRegime}`);
    }
    console.log(`Régime actuel   : ${stats.currentRegime}`);
    console.log(`Durée           : ${stats.duration}ms`);

    process.exit(0);
  } catch (error) {
    logger.error("\n💥 ÉCHEC DU BATCH MACRO", getErrorMessage(error));
    process.exit(1);
  }
}

// Exécution automatique
main();

export { runMacroBatch };
