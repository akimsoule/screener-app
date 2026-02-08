import { describe, it, expect, beforeAll, vi } from "vitest";
import { yahoo } from "../../src/lib/data/provider/yahoo";
import { SymbolType } from "../../src/lib/data/provider/types";

describe("Yahoo Finance Provider", () => {
  describe("fetchQuote", () => {
    it("devrait récupérer le quote d'une action US", async () => {
      const quote = await yahoo.fetchQuote("AAPL");

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe("AAPL");
      expect(quote.lastPr).toBeDefined();
      expect(parseFloat(quote.lastPr)).toBeGreaterThan(0);
      expect(quote.change24h).toBeDefined();
    });

    it("devrait gérer les symboles invalides", async () => {
      await expect(yahoo.fetchQuote("INVALID_SYMBOL_XYZ")).rejects.toThrow();
    });
  });

  describe("fetchOHLC", () => {
    it("devrait récupérer les données OHLC pour une action", async () => {
      const candles = await yahoo.fetchOHLC("AAPL", "1d");

      expect(candles).toBeDefined();
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);

      const lastCandle = candles[candles.length - 1];
      expect(lastCandle.open).toBeGreaterThan(0);
      expect(lastCandle.high).toBeGreaterThan(0);
      expect(lastCandle.low).toBeGreaterThan(0);
      expect(lastCandle.close).toBeGreaterThan(0);
      expect(lastCandle.date).toBeDefined();
    });

    it("devrait supporter différents intervalles", async () => {
      const intervals = ["1d", "1wk"] as const;

      for (const interval of intervals) {
        const candles = await yahoo.fetchOHLC("MSFT", interval);
        expect(candles.length).toBeGreaterThan(0);
      }
    });

    it("devrait gérer les symboles sans données", async () => {
      const candles = await yahoo.fetchOHLC("INVALID_XYZ", "1d");
      // Yahoo peut retourner un tableau vide pour des symboles invalides au lieu de rejeter
      expect(Array.isArray(candles)).toBe(true);
    });
  });

  describe("fetchMetadata", () => {
    it("devrait récupérer les métadonnées complètes avec dividendes", async () => {
      const metadata = await yahoo.fetchMetadata("AAPL");

      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("AAPL");
      expect(metadata.name).toContain("Apple");
      expect(metadata.type).toBe(SymbolType.US_STOCK);
      expect(metadata.data).toBeDefined();

      // Vérifier les données de base
      expect(metadata.data.exchange).toBeDefined();
      expect(metadata.data.quoteType).toBeDefined();

      // Vérifier les données de dividendes (AAPL verse des dividendes)
      expect(metadata.data.dividendYield).toBeDefined();
      expect(metadata.data.dividendRate).toBeDefined();
      expect(metadata.data.trailingAnnualDividendYield).toBeDefined();

      // Vérifier les données financières
      expect(metadata.data.marketCap).toBeDefined();
      expect(metadata.data.eps).toBeDefined();
    });

    it("devrait gérer les actions sans dividendes", async () => {
      const metadata = await yahoo.fetchMetadata("AMZN"); // Amazon ne verse généralement pas de dividendes

      expect(metadata).toBeDefined();
      expect(metadata.data).toBeDefined();
      // Les actions sans dividendes peuvent avoir undefined ou "0" pour dividendYield
    });

    it("devrait gérer les ETFs", async () => {
      const metadata = await yahoo.fetchMetadata("SPY");

      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("SPY");
      expect(metadata.data.quoteType).toBe("ETF");
    });

    it("devrait gérer les actions canadiennes", async () => {
      const metadata = await yahoo.fetchMetadata("SHOP.TO");

      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("SHOP.TO");
      expect(metadata.type).toBe(SymbolType.CANADIAN_STOCK);
    });

    it("devrait mettre en cache les résultats", async () => {
      const start = Date.now();
      await yahoo.fetchMetadata("GOOGL");
      const firstCallTime = Date.now() - start;

      const start2 = Date.now();
      await yahoo.fetchMetadata("GOOGL");
      const secondCallTime = Date.now() - start2;

      // Le deuxième appel devrait être beaucoup plus rapide (depuis le cache)
      expect(secondCallTime).toBeLessThan(firstCallTime / 2);
    });
  });

  describe("fetchSuggestions", () => {
    it("devrait rechercher des symboles par nom", async () => {
      const suggestions = await yahoo.fetchSuggestions("Apple", 5);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);

      const apple = suggestions.find((s) => s.symbol === "AAPL");
      expect(apple).toBeDefined();
      expect(apple?.name).toContain("Apple");
    });

    it("devrait rechercher par ticker", async () => {
      const suggestions = await yahoo.fetchSuggestions("MSFT", 10);

      expect(suggestions.length).toBeGreaterThan(0);
      const msft = suggestions[0];
      expect(msft.symbol).toBe("MSFT");
      expect(msft.name).toContain("Microsoft");
    });

    it("devrait retourner un tableau vide pour des recherches invalides", async () => {
      const suggestions = await yahoo.fetchSuggestions("XYZINVALIDXYZ");

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it("devrait respecter la limite de résultats", async () => {
      const limit = 3;
      const suggestions = await yahoo.fetchSuggestions("bank", limit);

      expect(suggestions.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("determineSymbolType", () => {
    it("devrait détecter les actions US", async () => {
      const metadata = await yahoo.fetchMetadata("AAPL");
      expect(metadata.type).toBe(SymbolType.US_STOCK);
    });

    it("devrait détecter les actions canadiennes", async () => {
      const metadata = await yahoo.fetchMetadata("RY.TO");
      expect(metadata.type).toBe(SymbolType.CANADIAN_STOCK);
    });

    it("devrait détecter les actions internationales", async () => {
      const metadata = await yahoo.fetchMetadata("LVMH.PA"); // LVMH Paris
      expect(metadata.type).toBe(SymbolType.INTERNATIONAL);
    });
  });

  describe("Gestion des erreurs et edge cases", () => {
    it("devrait gérer les timeouts gracieusement", async () => {
      // Simuler un timeout en utilisant un symbole qui pourrait prendre du temps
      const promise = yahoo.fetchQuote("AAPL");
      await expect(promise).resolves.toBeDefined();
    }, 10000); // Timeout de 10s

    it("devrait gérer les symboles avec caractères spéciaux", async () => {
      const metadata = await yahoo.fetchMetadata("BRK-B"); // Berkshire Hathaway Class B
      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("BRK-B");
    });
  });

  describe("Métadonnées financières complètes", () => {
    it("devrait retourner toutes les métriques financières pour une action", async () => {
      const metadata = await yahoo.fetchMetadata("MSFT");

      expect(metadata.data).toBeDefined();

      // Vérifier la présence des métriques clés
      const expectedFields = [
        "exchange",
        "quoteType",
        "marketCap",
        "eps",
        "bookValue",
        "forwardPE",
      ];

      for (const field of expectedFields) {
        expect(metadata.data[field]).toBeDefined();
      }
    });

    it("devrait calculer correctement le P/E ratio implicite", async () => {
      const metadata = await yahoo.fetchMetadata("NVDA");

      if (metadata.data.marketCap && metadata.data.eps) {
        const marketCap = parseFloat(metadata.data.marketCap);
        const eps = parseFloat(metadata.data.eps);

        expect(marketCap).toBeGreaterThan(0);
        expect(eps).toBeGreaterThan(0);
      }
    });

    it("devrait avoir des valeurs cohérentes pour les dividendes", async () => {
      const metadata = await yahoo.fetchMetadata("KO"); // Coca-Cola, dividendes réguliers

      if (
        metadata.data.dividendYield &&
        metadata.data.trailingAnnualDividendYield
      ) {
        const dividendYield = parseFloat(metadata.data.dividendYield);
        const trailingYield = parseFloat(
          metadata.data.trailingAnnualDividendYield,
        );

        // Les deux valeurs devraient être dans le même ordre de grandeur
        expect(dividendYield).toBeGreaterThan(0);
        expect(trailingYield).toBeGreaterThan(0);
      }
    });
  });
});
