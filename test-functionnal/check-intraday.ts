import { getPrices } from "../src/app/analysis/prices.js";

try {
  const symbol = "AAPL";
  const interval = "15min"; // 15 minutes

  console.log(`Fetching ${interval} data for ${symbol}...`);

  const data = await getPrices(symbol, interval);

  if (data.length > 0) {
    const lastCandle = data[data.length - 1];
    const lastDate = new Date(lastCandle.date);
    const now = new Date();
    const ageMinutes = (now.getTime() - lastDate.getTime()) / (1000 * 60);

    console.log("\n📊 Data analysis:");
    console.log(`Total candles: ${data.length}`);
    console.log("Last 10 times:");
    data.slice(-10).forEach((c) => {
      const d = new Date(c.date);
      console.log(
        `  - ${d.toLocaleTimeString()} (close: ${c.close.toFixed(2)})`,
      );
    });
    console.log(`\nLast data: ${lastDate.toLocaleString()}`);
    console.log(`Current time: ${now.toLocaleString()}`);
    console.log(`Age: ${ageMinutes.toFixed(1)} minutes`);
  } else {
    console.log("❌ No data received");
  }
} catch (error) {
  console.error("Error fetching intraday data:", error);
} finally {
  process.exit(0);
}
