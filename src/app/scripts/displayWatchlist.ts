#!/usr/bin/env tsx
import "dotenv/config";
import { logger } from "../lib/logger.js";
import { watchlistService } from "../analysis/services/watchlistService.js";
import type { FilterOptions } from "../analysis/services/filterService.js";

/**
 * SCRIPT D'AFFICHAGE DE LA WATCHLIST
 * Usage:
 *   tsx src/scripts/displayWatchlist.ts --page=1 --limit=10 --industry=Semiconductors --scoreMin=60
 */

// Valeurs par défaut (modifiable directement ici)
const DEFAULT_ARGS = {
  page: 1,
  limit: 10,
  industry: null as string | null,
  sector: null as string | null,
  exchange: null as string | null,
  quoteCurrency: null as string | null,
  symbolType: null as string | null,
  provider: null as string | null,
  scoreMin: undefined as number | undefined,
  scoreMax: undefined as number | undefined,
  dividendYieldMin: undefined as number | undefined,
  dividendYieldMax: undefined as number | undefined,
  marketCapMin: undefined as number | undefined,
  marketCapMax: undefined as number | undefined,
};

function parseArgs(argv: string[]): {
  options: FilterOptions;
  page: number;
  limit: number;
} {
  const args = argv.slice(2);
  // initialiser avec defaults
  const options: any = {};
  let page = DEFAULT_ARGS.page;
  let limit = DEFAULT_ARGS.limit;

  // appliquer defaults de filtres si fournis
  if (DEFAULT_ARGS.industry)
    options.industry = DEFAULT_ARGS.industry.split(",");
  if (DEFAULT_ARGS.sector) options.sector = DEFAULT_ARGS.sector.split(",");
  if (DEFAULT_ARGS.exchange)
    options.exchange = DEFAULT_ARGS.exchange.split(",");
  if (DEFAULT_ARGS.quoteCurrency)
    options.quoteCurrency = DEFAULT_ARGS.quoteCurrency.split(",");
  if (DEFAULT_ARGS.symbolType)
    options.symbolType = DEFAULT_ARGS.symbolType.split(",");
  if (DEFAULT_ARGS.provider)
    options.provider = DEFAULT_ARGS.provider.split(",");
  if (DEFAULT_ARGS.scoreMin !== undefined)
    options.scoreMin = DEFAULT_ARGS.scoreMin;
  if (DEFAULT_ARGS.scoreMax !== undefined)
    options.scoreMax = DEFAULT_ARGS.scoreMax;
  if (DEFAULT_ARGS.dividendYieldMin !== undefined)
    options.dividendYieldMin = DEFAULT_ARGS.dividendYieldMin;
  if (DEFAULT_ARGS.dividendYieldMax !== undefined)
    options.dividendYieldMax = DEFAULT_ARGS.dividendYieldMax;
  if (DEFAULT_ARGS.marketCapMin !== undefined)
    options.marketCapMin = DEFAULT_ARGS.marketCapMin;
  if (DEFAULT_ARGS.marketCapMax !== undefined)
    options.marketCapMax = DEFAULT_ARGS.marketCapMax;

  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (!value) continue;

    switch (key) {
      case "page":
        page = Number(value) || DEFAULT_ARGS.page;
        break;
      case "limit":
        limit = Number(value) || DEFAULT_ARGS.limit;
        break;
      case "industry":
      case "sector":
      case "exchange":
      case "quoteCurrency":
      case "symbolType":
      case "provider":
        options[key] = value.split(",");
        break;
      case "scoreMin":
        options.scoreMin = Number(value);
        break;
      case "scoreMax":
        options.scoreMax = Number(value);
        break;
      case "dividendYieldMin":
        options.dividendYieldMin = Number(value);
        break;
      case "dividendYieldMax":
        options.dividendYieldMax = Number(value);
        break;
      case "marketCapMin":
        options.marketCapMin = Number(value);
        break;
      case "marketCapMax":
        options.marketCapMax = Number(value);
        break;
      default:
        // ignore unknown
        break;
    }
  }

  return { options, page, limit };
}

function formatItem(item: any): string {
  const lines: string[] = [];
  lines.push(`- ${item.name} (${item.symbolType || "N/A"})`);
  lines.push(`   Provider: ${item.provider || "N/A"}`);
  lines.push(
    `   LastAction: ${item.lastAction || "N/A"}  Score: ${item.lastScore ?? "N/A"}  Price: ${item.lastPrice ?? "N/A"}`,
  );
  if (item.analysis) {
    const a = item.analysis;
    lines.push(
      `   Analysis: ${a.action} | Score: ${a.score} | Regime: ${a.regime}`,
    );
  }
  if (item.cacheKey) lines.push(`   CacheKey: ${item.cacheKey}`);
  return lines.join("\n");
}

async function main() {
  const { options, page, limit } = parseArgs(process.argv);
  logger.info(
    `🔎 Fetching watchlist (page=${page}, limit=${limit}) with filters: ${JSON.stringify(options)}`,
  );

  try {
    const result = await watchlistService.getWatchlist(options, page, limit);

    console.log(
      `\n📋 WATCHLIST — page ${result.pagination.page}/${result.pagination.totalPages} — total: ${result.pagination.total}\n`,
    );

    for (const item of result.data) {
      console.log(formatItem(item));
      console.log("");
    }

    console.log(
      `---\nApplied filters: ${JSON.stringify(result.appliedFilters)}\n`,
    );
    logger.info("✅ Watchlist display completed");
    process.exit(0);
  } catch (err) {
    logger.error("❌ Error fetching watchlist:", err);
    process.exit(1);
  }
}

try {
  await main();
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}
