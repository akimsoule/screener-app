import { fetchMetadata } from "../src/app/lib/data";
import { SymbolType } from "../src/app/lib/data/provider/types";

console.log("🔍 Fetching metadata for AAPL...");
try {
  const metadata = await fetchMetadata("AAPL", SymbolType.US_STOCK);
  console.log("✓ Got metadata:", JSON.stringify(metadata, null, 2));
} catch (error) {
  console.error("❌ Error:", error);
}

process.exit(0);
