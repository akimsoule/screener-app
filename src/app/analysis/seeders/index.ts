import { Prisma } from "@prisma/client";
import { fetchMetadata } from "../../lib/data";
import { prisma } from "../../lib/prisma";
import { detectSymbolType } from "../prices";
import { getErrorMessage } from "../../lib/logger.js";
import { bitget } from "../../lib/data/provider/bitget.js";
import { existingSymbols } from "./existing_symbol";

async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}...`,
    );

    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Délai entre les batches (sauf pour le dernier)
    if (i + batchSize < items.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

async function fillMetadata() {
  console.log("🧹 Cleaning empty metadata cache...");
  const deletedCache = await prisma.cache.deleteMany({
    where: {
      category: "metadata",
      OR: [{ value: { equals: Prisma.JsonNull } }, { value: { equals: {} } }],
    },
  });
  console.log(`Deleted ${deletedCache.count} cached metadata entries\n`);

  // 1) Backfill existing symbols in DB that have missing enrichment
  const missing = await prisma.symbol.findMany({
    where: {
      OR: [{ metadata: { equals: Prisma.JsonNull } }, { symbolType: null }],
    },
    select: {
      id: true,
      name: true,
      symbolType: true,
      metadata: true,
    },
  });

  console.log(`Found ${missing.length} symbol(s) needing backfill.`);

  const backfillProcessor = async (row: (typeof missing)[0]) => {
    try {
      // Détecter automatiquement le type de symbole
      const symbolType = detectSymbolType(row.name);
      const details = await fetchMetadata(row.name, symbolType);
      if (!details) return null;

      const data: Record<string, any> = {};
      if (!row.symbolType) data.symbolType = details.type;
      if (!row.metadata) {
        data.metadata = {
          name: details.name || row.name,
          data: details.data || {},
        };
      }

      if (Object.keys(data).length === 0) return null;
      return prisma.symbol.update({ where: { id: row.id }, data });
    } catch (err) {
      console.error(`Failed to backfill ${row.name}:`, err);
      return null;
    }
  };

  // Traiter 3 symboles par batch avec délai de 2s entre les batches
  const backfilled = await processBatch(missing, 3, 2000, backfillProcessor);
  console.log(
    `Backfilled ${backfilled.filter(Boolean).length} symbol(s) with missing info.`,
  );
}

async function fillFromExistingBd() {
  // Nettoyer d'abord les cryptos invalides existantes
  console.log("🧹 Nettoyage des cryptos invalides existantes...");
  const existingCryptos = await prisma.symbol.findMany({
    where: { symbolType: "CRYPTO" },
    select: { id: true, name: true },
  });

  const toDelete = new Set<string>();

  // Valider par batches pour éviter rate limiting
  const batchSize = 10;
  for (let i = 0; i < existingCryptos.length; i += batchSize) {
    const batch = existingCryptos.slice(i, i + batchSize);
    console.log(
      `Validation batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(existingCryptos.length / batchSize)}...`,
    );

    const promises = batch.map(async (symbol) => {
      try {
        const normalized = bitget.normalizeSymbol(symbol.name);
        await bitget.fetchQuote(normalized);
        console.log(`✅ ${symbol.name} validé (${normalized})`);
      } catch (error) {
        console.log(
          `❌ ${symbol.name} invalide - marqué pour suppression: ${getErrorMessage(error)}`,
        );
        toDelete.add(symbol.id);
      }
    });

    await Promise.allSettled(promises);

    // Petite pause entre batches
    if (i + batchSize < existingCryptos.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  const idsToDelete = Array.from(toDelete);
  if (idsToDelete.length > 0) {
    // Récupérer quelques noms pour logging
    const toDeleteRows = await prisma.symbol.findMany({
      where: { id: { in: idsToDelete } },
      select: { id: true, name: true },
    });
    console.log(
      `🧾 Exemples à supprimer: ${toDeleteRows
        .slice(0, 10)
        .map((r) => r.name)
        .join(", ")}`,
    );

    // Supprimer en chunks pour limiter l'impact
    const chunkSize = 100;
    let deletedTotal = 0;
    while (idsToDelete.length) {
      const chunk = idsToDelete.splice(0, chunkSize);
      const result = await prisma.symbol.deleteMany({
        where: { id: { in: chunk } },
      });
      deletedTotal += result.count;
      console.log(`🗑️ Supprimé ${result.count} cryptos (batch)`);
    }

    console.log(`✅ Supprimé ${deletedTotal} cryptos invalides au total`);
  } else {
    console.log("🎉 Aucune crypto invalide trouvée");
  }

  console.log(
    `\n📥 Importing ${existingSymbols.length} symbols from JSON file...`,
  );

  const importProcessor = async (symbolData: (typeof existingSymbols)[0]) => {
    try {
      let { name, enabled, isPopular, exchange, industry, sector, type } =
        symbolData;

      // Normaliser le type du JSON vers SymbolType
      let normalizedType = type;
      if (type === "EQUITY" || type === "ETF") {
        normalizedType = detectSymbolType(name); // Auto-detect basé sur le nom
      }

      // Détecter automatiquement le type de symbole si non fourni
      const symbolType = normalizedType || detectSymbolType(name);

      // Si le type est une crypto, vérifier la présence de mapping dans Bitget et normaliser le nom
      if (symbolType === "CRYPTO") {
        const normalized = bitget.normalizeSymbol(name);
        try {
          await bitget.fetchQuote(normalized);
          console.log(`✅ ${name} → ${normalized} validé sur Bitget`);
          name = normalized; // utiliser le symbole normalisé
        } catch (error) {
          console.log(
            `❌ ${name} → ${normalized} non trouvé sur Bitget - ignoré: ${getErrorMessage(error)}`,
          );
          return null; // Ne pas importer les cryptos invalides
        }
      }

      // Récupérer les métadonnées enrichies depuis les providers (Yahoo, Bitget)
      let metadata;
      try {
        const details = await fetchMetadata(name, symbolType as any);
        if (details) {
          // Utiliser directement les métadonnées du provider - elles sont complètes
          metadata = {
            name: details.name || name,
            data: details.data, // Les providers (Yahoo/Bitget) fournissent toutes les données nécessaires
          };
        } else {
          // Fallback si fetchMetadata échoue
          metadata = {
            name: name,
            data: {
              exchange: exchange || undefined,
              industry: industry || undefined,
              sector: sector || undefined,
            },
          };
        }
      } catch (error) {
        console.log(
          `⚠️  Impossible de récupérer les métadonnées pour ${name}: ${getErrorMessage(error)}`,
        );
        // Fallback sur métadonnées minimales du JSON
        metadata = {
          name: name,
          data: {
            exchange: exchange || undefined,
            industry: industry || undefined,
            sector: sector || undefined,
          },
        };
      }

      return prisma.symbol.upsert({
        where: { name },
        update: {
          enabled,
          isPopular,
          symbolType,
          metadata,
          updatedAt: new Date(),
        },
        create: {
          name,
          enabled,
          isPopular,
          symbolType,
          metadata,
        },
      });
    } catch (err) {
      console.error(`Failed to import ${symbolData.name}:`, err);
      return null;
    }
  };

  // Traiter 3 symboles par batch avec délai de 2s entre les batches pour éviter rate limiting Yahoo
  const imported = await processBatch(
    existingSymbols,
    3,
    2000,
    importProcessor,
  );
  const successCount = imported.filter(Boolean).length;
  console.log(
    `✅ Imported ${successCount}/${existingSymbols.length} symbols successfully.`,
  );

  // Afficher quelques exemples
  const examples = imported.filter(Boolean).slice(0, 5);
  console.log("\n📊 Examples imported:");
  examples.forEach(
    (s) =>
      s &&
      console.log(
        `   - ${s.name} (${s.symbolType}) ${s.isPopular ? "⭐" : ""}`,
      ),
  );
}

export { fillMetadata, fillFromExistingBd };
