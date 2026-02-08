import { bitget } from "../src/app/lib/data/provider/bitget.js";

try {
  console.log("Testing Bitget fetchQuote...\n");

  const symbols = ["BTCUSDT", "ETHUSDT"];

  for (const symbol of symbols) {
    try {
      const quote = await bitget.fetchQuote(symbol);
      const priceStr = quote
        ? `$${Number.parseFloat(quote.lastPr).toFixed(2)}`
        : "null";
      console.log(`${symbol}: ${priceStr}`);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`${symbol}: Error -`, error.message);
      } else {
        console.error(`${symbol}: Error -`, error);
      }
    }
  }
} catch (error) {
  console.error("Error testing Bitget:", error);
} finally {
  process.exit(0);
}
