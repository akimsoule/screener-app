#!/usr/bin/env tsx
/**
 * Script d'analyse en batch
 * Traite 20 symboles dont l'analyse date de plus de 15 minutes
 */

import "dotenv/config";
import { prisma } from "../../../lib/prisma";
import { analysisService } from "../services/analysisService";
import { analyzeMacroContextWithRealData } from "../services/macroService";
import { fetchRealMacroData } from "../services/macroDataService";

const BATCH_SIZE = 20;
const STALE_THRESHOLD_MINUTES = 15;

interface BatchStats {
  total: number;
  success: number;
  errors: number;
  duration: number;
}

async function runBatch(): Promise<BatchStats> {
  const startTime = Date.now();

  console.log("\n" + "=".repeat(80));
  console.log("🔄 ANALYSE BATCH");
  console.log("=".repeat(80));

  // 1. Calculer le timestamp de seuil (15 minutes en arrière)
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000,
  );

  // 2. Récupérer les symboles à analyser
  console.log(
    `\n🔍 Recherche de symboles avec analyse > ${STALE_THRESHOLD_MINUTES} min...`,
  );

  const symbols = await prisma.symbol.findMany({
    where: {
      enabled: true,
      OR: [{ analyzedAt: null }, { analyzedAt: { lt: staleThreshold } }],
    },
    orderBy: [
      { analyzedAt: "asc" }, // Les plus anciens d'abord
    ],
    take: BATCH_SIZE,
  });

  if (symbols.length === 0) {
    console.log("✅ Aucun symbole à analyser (tous à jour)");
    return {
      total: 0,
      success: 0,
      errors: 0,
      duration: Date.now() - startTime,
    };
  }

  console.log(`📊 ${symbols.length} symboles à analyser :`);
  console.log(`   ${symbols.map((s) => s.name).join(", ")}\n`);

  // 4. Récupérer les données macro réelles (format attendu par detectMacroRegime)
  const realMacro = await fetchRealMacroData();
  const { _metadata, ...marketData } = realMacro; // marketData correspond à fedDotPlot2025, marketPricing2025, ismPmi, ...
  const macroContext = marketData; // type compatible avec detectMacroRegime
  const vixValue = (_metadata as any)?.vix ?? 0;

  // 5. Analyser les symboles en parallèle en réutilisant le contexte macro
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const analysis = await analysisService.analyzeSymbolWithMacro(
          symbol.name,
          macroContext,
          {
            riskConfig: {
              accountSize: 100000,
              riskPercentPerTrade: 1,
              vixValue,
            },
          },
        );

        // Mettre à jour analyzedAt
        await prisma.symbol.update({
          where: { id: symbol.id },
          data: { analyzedAt: new Date() },
        });

        // ✅ Supprimer l'erreur "Données insuffisantes" si elle existait
        await prisma.analysisError.deleteMany({
          where: {
            symbolId: symbol.id,
            errorType: "INSUFFICIENT_DATA",
          },
        });

        return { success: true, symbol: symbol.name, analysis };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`❌ Erreur ${symbol.name}:`, errorMessage);

        // Déterminer le type d'erreur
        let errorType = "ANALYSIS_ERROR";
        const metadata: any = {};

        if (errorMessage.includes("Données insuffisantes")) {
          errorType = "INSUFFICIENT_DATA";
          // Extraire les infos des données (ex: "126/100j, 18/20s")
          const match = new RegExp(/\((\d+)\/(\d+)j, (\d+)\/(\d+)s\)/).exec(
            errorMessage,
          );
          if (match) {
            metadata.dailyCandles = Number.parseInt(match[1]);
            metadata.dailyRequired = Number.parseInt(match[2]);
            metadata.weeklyCandles = Number.parseInt(match[3]);
            metadata.weeklyRequired = Number.parseInt(match[4]);
          }
        } else if (errorMessage.includes("API error")) {
          errorType = "API_ERROR";
        }

        // Logger l'erreur dans la table (upsert pour incrémenter le count)
        await prisma.analysisError.upsert({
          where: {
            symbolId_errorType: {
              symbolId: symbol.id,
              errorType,
            },
          },
          create: {
            symbolId: symbol.id,
            symbolName: symbol.name,
            errorType,
            errorMessage,
            metadata,
            count: 1,
          },
          update: {
            errorMessage,
            metadata,
            count: { increment: 1 },
            lastOccurredAt: new Date(),
          },
        });

        // Marquer comme traité même en cas d'erreur pour éviter les retry infinis
        await prisma.symbol.update({
          where: { id: symbol.id },
          data: { analyzedAt: new Date() },
        });

        return { success: false, symbol: symbol.name, error };
      }
    }),
  );

  // 5. Calculer les statistiques
  const stats: BatchStats = {
    total: symbols.length,
    success: results.filter((r) => r.status === "fulfilled" && r.value.success)
      .length,
    errors: results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success),
    ).length,
    duration: Date.now() - startTime,
  };

  // 6. Afficher les résultats
  console.log("\n" + "=".repeat(80));
  console.log("📊 RÉSULTATS");
  console.log("=".repeat(80));
  console.log(`✅ Succès: ${stats.success}/${stats.total}`);
  console.log(`❌ Erreurs: ${stats.errors}/${stats.total}`);
  console.log(`⏱️  Durée: ${(stats.duration / 1000).toFixed(1)}s`);

  // Afficher quelques analyses réussies
  const successfulAnalyses = results
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<{
        success: true;
        symbol: string;
        analysis: any;
      }> => r.status === "fulfilled" && r.value.success,
    )
    .slice(0, 10);

  if (successfulAnalyses.length > 0) {
    console.log("\n📈 Analyses (top 10):");
    successfulAnalyses.forEach(({ value }) => {
      const { symbol, analysis } = value;
      const score = analysis.score;
      const action = analysis.action;
      console.log(
        `   ${symbol.padEnd(15)} Score: ${String(score).padStart(4)} | ${action}`,
      );
    });
  }

  // Statistiques globales
  const totalSymbols = await prisma.symbol.count({ where: { enabled: true } });
  const analyzedRecently = await prisma.symbol.count({
    where: {
      enabled: true,
      analyzedAt: { gte: staleThreshold },
    },
  });

  console.log(
    `\n📊 État global: ${analyzedRecently}/${totalSymbols} à jour (< ${STALE_THRESHOLD_MINUTES} min)`,
  );
  console.log("=".repeat(80) + "\n");

  return stats;
}

// Exécution avec top-level await
try {
  const stats = await runBatch();
  await prisma.$disconnect();
  process.exit(stats.errors > 0 ? 1 : 0);
} catch (error) {
  console.error("❌ Erreur fatale:", error);
  await prisma.$disconnect();
  process.exit(1);
}
