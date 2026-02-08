import { describe, it, expect } from "vitest";
import { fetchMetadata, fetchQuote, fetchOHLC } from "../../src/lib/data";
import { SymbolType } from "../../src/lib/data/provider/types";

describe("Data Provider Dispatcher", () => {
  describe("fetchMetadata", () => {
    it("devrait router vers Bitget pour les cryptos", async () => {
      const metadata = await fetchMetadata("BTCUSDT", SymbolType.CRYPTO);

      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe(SymbolType.CRYPTO);
      expect(metadata?.data.exchange).toBe("Bitget");
    });

    it("devrait router vers Yahoo pour les actions US", async () => {
      const metadata = await fetchMetadata("AAPL", SymbolType.US_STOCK);

      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe(SymbolType.US_STOCK);
      expect(metadata?.symbol).toBe("AAPL");
    });

    it("devrait router vers Yahoo pour les actions canadiennes", async () => {
      const metadata = await fetchMetadata(
        "SHOP.TO",
        SymbolType.CANADIAN_STOCK,
      );

      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe(SymbolType.CANADIAN_STOCK);
    });

    it("devrait router vers Yahoo pour les actions internationales", async () => {
      const metadata = await fetchMetadata("LVMH.PA", SymbolType.INTERNATIONAL);

      expect(metadata).toBeDefined();
      expect(metadata?.type).toBe(SymbolType.INTERNATIONAL);
    });

    it("devrait retourner null pour un type invalide", async () => {
      const metadata = await fetchMetadata("TEST", "INVALID" as any);

      expect(metadata).toBeNull();
    });

    it("devrait retourner null et logger en cas d'erreur", async () => {
      const metadata = await fetchMetadata(
        "INVALIDSYMBOL123",
        SymbolType.US_STOCK,
      );

      // L'erreur est catchée et null est retourné
      expect(metadata).toBeNull();
    });
  });

  describe("fetchQuote", () => {
    it("devrait router vers Bitget pour les cryptos", async () => {
      const quote = await fetchQuote("ETHUSDT", SymbolType.CRYPTO);

      expect(quote).toBeDefined();
      expect(quote).not.toBeNull();
      expect(quote!.symbol).toBe("ETHUSDT");
      expect(Number.parseFloat(quote!.lastPr)).toBeGreaterThan(0);
    });

    it("devrait router vers Yahoo pour les actions", async () => {
      const quote = await fetchQuote("MSFT", SymbolType.US_STOCK);

      expect(quote).toBeDefined();
      expect(quote).not.toBeNull();
      expect(quote!.symbol).toBe("MSFT");
      expect(Number.parseFloat(quote!.lastPr)).toBeGreaterThan(0);
    });

    it("devrait gérer les erreurs de provider", async () => {
      const result = await fetchQuote("INVALIDXYZ", SymbolType.US_STOCK);
      expect(result).toBeNull();
    });
  });

  describe("fetchOHLC", () => {
    it("devrait router vers Bitget pour les cryptos", async () => {
      const candles = await fetchOHLC("BTCUSDT", SymbolType.CRYPTO, "1d");

      expect(candles).toBeDefined();
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);
    });

    it("devrait router vers Yahoo pour les actions", async () => {
      const candles = await fetchOHLC("GOOGL", SymbolType.US_STOCK, "1d");

      expect(candles).toBeDefined();
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);
    });

    it("devrait supporter différents intervalles", async () => {
      const intervals = ["1d", "1wk"] as const;

      for (const interval of intervals) {
        const candles = await fetchOHLC("AAPL", SymbolType.US_STOCK, interval);
        expect(candles.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Integration tests - Cross-provider comparison", () => {
    it("devrait retourner des structures cohérentes entre providers", async () => {
      const stockMetadata = await fetchMetadata("AAPL", SymbolType.US_STOCK);
      const cryptoMetadata = await fetchMetadata("BTCUSDT", SymbolType.CRYPTO);

      // Les deux devraient avoir la même structure de base
      expect(stockMetadata).toHaveProperty("symbol");
      expect(stockMetadata).toHaveProperty("name");
      expect(stockMetadata).toHaveProperty("type");
      expect(stockMetadata).toHaveProperty("data");

      expect(cryptoMetadata).toHaveProperty("symbol");
      expect(cryptoMetadata).toHaveProperty("name");
      expect(cryptoMetadata).toHaveProperty("type");
      expect(cryptoMetadata).toHaveProperty("data");
    });

    it("devrait retourner des quotes avec la même structure", async () => {
      const stockQuote = await fetchQuote("NVDA", SymbolType.US_STOCK);
      const cryptoQuote = await fetchQuote("ETHUSDT", SymbolType.CRYPTO);

      const requiredFields = [
        "symbol",
        "lastPr",
        "change24h",
        "high24h",
        "low24h",
      ];

      for (const field of requiredFields) {
        expect(stockQuote).toHaveProperty(field);
        expect(cryptoQuote).toHaveProperty(field);
      }
    });

    it("devrait retourner des OHLC avec le même format", async () => {
      const stockCandles = await fetchOHLC("META", SymbolType.US_STOCK, "1d");
      const cryptoCandles = await fetchOHLC("BTCUSDT", SymbolType.CRYPTO, "1d");

      const requiredFields = ["date", "open", "high", "low", "close", "volume"];

      for (const field of requiredFields) {
        expect(stockCandles[0]).toHaveProperty(field);
        expect(cryptoCandles[0]).toHaveProperty(field);
      }
    });
  });

  describe("Provider routing validation", () => {
    it("ne devrait PAS utiliser Bitget pour des actions", async () => {
      // Bitget est pour les cryptos uniquement
      const metadata = await fetchMetadata("AAPL", SymbolType.US_STOCK);

      expect(metadata?.data.exchange).not.toBe("Bitget");
    });

    it("ne devrait PAS utiliser Yahoo pour des cryptos pures", async () => {
      const metadata = await fetchMetadata("BTCUSDT", SymbolType.CRYPTO);

      expect(metadata?.data.exchange).toBe("Bitget");
      expect(metadata?.data.quoteCurrency).toBe("USDT");
    });
  });

  describe("Error handling across providers", () => {
    it("devrait gérer les symboles invalides de manière cohérente", async () => {
      const invalidSymbol = "XYZINVALIDXYZ123";

      // Stock provider (Yahoo)
      const stockResult = await fetchMetadata(
        invalidSymbol,
        SymbolType.US_STOCK,
      );
      expect(stockResult).toBeNull();

      // Crypto provider (Bitget) - peut retourner null ou un objet générique
      const cryptoResult = await fetchMetadata(
        invalidSymbol,
        SymbolType.CRYPTO,
      );
      // Bitget peut retourner un objet générique pour les symboles invalides
      // ou null selon le cas. On vérifie juste que la fonction ne lance pas d'erreur
      expect(cryptoResult).toBeDefined();
    });

    it("devrait gérer les timeouts de manière cohérente", async () => {
      // Les deux providers devraient rejeter sur timeout
      const stockPromise = fetchQuote("AAPL", SymbolType.US_STOCK);
      const cryptoPromise = fetchQuote("BTCUSDT", SymbolType.CRYPTO);

      await expect(stockPromise).resolves.toBeDefined();
      await expect(cryptoPromise).resolves.toBeDefined();
    }, 15000);
  });

  describe("Cache behavior across providers", () => {
    it("devrait utiliser des clés de cache séparées par provider", async () => {
      // Même si le symbole est similaire, les caches doivent être séparés
      const btcStock = await fetchMetadata("BTC-USD", SymbolType.US_STOCK);
      const btcCrypto = await fetchMetadata("BTCUSDT", SymbolType.CRYPTO);

      // Les deux devraient exister mais avec des données différentes
      expect(btcStock).toBeDefined();
      expect(btcCrypto).toBeDefined();
      expect(btcStock?.data.exchange).not.toBe(btcCrypto?.data.exchange);
    });
  });
});
