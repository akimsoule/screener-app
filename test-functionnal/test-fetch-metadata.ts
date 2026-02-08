import { yahoo } from "../src/lib/data/provider/yahoo";

console.log("📡 Test fetchMetadata pour AAPL...\n");

try {
  const metadata = await yahoo.fetchMetadata("AAPL");
  console.log("Résultat:", JSON.stringify(metadata, null, 2));
} catch (error) {
  console.error("Erreur:", error);
}

process.exit(0);
