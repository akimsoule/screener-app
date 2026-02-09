#!/usr/bin/env tsx

import { logger } from "../../app/lib/logger.js";
import { pennyService } from "../../app/analysis/services/pennyService.js";

try {
  logger.info("🚀 Running pennyService.scan()...");
  const results = await pennyService.scan();
  console.log("\n📊 RÉSULTATS DU SCANNING:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  logger.error("❌ Error running pennyService.scan():", err);
  process.exit(1);
} finally {
  process.exit(0);
}
