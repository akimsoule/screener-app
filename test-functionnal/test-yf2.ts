import YahooFinance from "yahoo-finance2";

console.log("📡 Test yahoo-finance2 pour AAPL...\n");

const yahooFinance = new YahooFinance();

try {
  const quote = await yahooFinance.quote("AAPL");
  console.log("\n━━━ Quote Data ━━━");
  console.log(`- symbol: ${quote.symbol}`);
  console.log(`- longName: ${quote.longName}`);
  console.log(`- dividendYield: ${quote.dividendYield}`);
  console.log(`- dividendRate: ${quote.dividendRate}`);
  console.log(
    `- trailingAnnualDividendYield: ${quote.trailingAnnualDividendYield}`,
  );
  console.log(
    `- trailingAnnualDividendRate: ${quote.trailingAnnualDividendRate}`,
  );
  console.log(`- marketCap: ${quote.marketCap}`);
  console.log(`- epsTrailingTwelveMonths: ${quote.epsTrailingTwelveMonths}`);
  console.log(`- forwardPE: ${quote.forwardPE}`);
  console.log(`- bookValue: ${quote.bookValue}`);
  console.log(`- priceToBook: ${quote.priceToBook}`);
} catch (error) {
  console.error("Erreur:", error);
} finally {
  process.exit(0);
}
