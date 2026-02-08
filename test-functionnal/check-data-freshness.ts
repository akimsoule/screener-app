import { getPrices } from "../src/app/analysis/prices.js";

try {
  const symbol = "AAPL";
  console.log(`Fetching data for ${symbol}...`);

  const data = await getPrices(symbol, "1d");

  if (data.length > 0) {
    const lastCandle = data[data.length - 1];
    const lastDate = new Date(lastCandle.date);
    const now = new Date();
    const ageHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

    console.log("\n📊 Data analysis:");
    console.log(`Total candles: ${data.length}`);
    console.log("Last 5 dates:");
    data
      .slice(-5)
      .forEach((c) => console.log(`  - ${c.date} (close: ${c.close})`));
    console.log(`\nLast data date: ${lastDate.toLocaleString()}`);
    console.log(`Current time: ${now.toLocaleString()}`);
    console.log(
      `Age: ${ageHours.toFixed(1)} hours (${(ageHours / 24).toFixed(1)} days)`,
    );
  } else {
    console.log("❌ No data received");
  }
} catch (error) {
  console.error("Error fetching data:", error);
} finally {
  process.exit(0);
}
