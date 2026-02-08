(async () => {
  console.log("📡 Test Yahoo QuoteSummary API pour AAPL...\n");

  try {
    const symbol = "AAPL";
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=summaryDetail,defaultKeyStatistics,financialData`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo quoteSummary API error: ${res.status}`);
    }

    const json = (await res.json()) as any;

    if (json.quoteSummary?.result && json.quoteSummary.result.length > 0) {
      const result = json.quoteSummary.result[0];
      console.log("\n━━━ Summary Detail ━━━");
      const summary = result.summaryDetail;
      console.log(`- dividendYield: ${summary?.dividendYield?.fmt}`);
      console.log(`- dividendRate: ${summary?.dividendRate?.fmt}`);
      console.log(
        `- trailingAnnualDividendYield: ${summary?.trailingAnnualDividendYield?.fmt}`,
      );
      console.log(
        `- trailingAnnualDividendRate: ${summary?.trailingAnnualDividendRate?.fmt}`,
      );
      console.log(`- marketCap: ${summary?.marketCap?.fmt}`);

      console.log("\n━━━ Default Key Stats ━━━");
      const stats = result.defaultKeyStatistics;
      console.log(`- forwardPE: ${stats?.forwardPE?.fmt}`);
      console.log(`- trailingEps: ${stats?.trailingEps?.fmt}`);
    } else {
      console.log("Aucun résultat");
    }
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    process.exit(0);
  }
})();
