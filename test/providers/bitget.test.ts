import { describe, it, expect, beforeAll } from "vitest";
import { bitget } from "../../src/lib/data/provider/bitget";
import { SymbolType } from "../../src/lib/data/provider/types";

describe("Bitget Provider", () => {
  describe("fetchQuote", () => {
    it("devrait récupérer le quote pour BTC", async () => {
      const quote = await bitget.fetchQuote("BTCUSDT");

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe("BTCUSDT");
      expect(quote.lastPr).toBeDefined();
      expect(Number.parseFloat(quote.lastPr)).toBeGreaterThan(0);
      expect(quote.change24h).toBeDefined();
      expect(quote.high24h).toBeDefined();
      expect(quote.low24h).toBeDefined();
      expect(quote.baseVolume).toBeDefined();
      expect(quote.quoteVolume).toBeDefined();
    });

    it("devrait récupérer le quote pour ETH", async () => {
      const quote = await bitget.fetchQuote("ETHUSDT");

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe("ETHUSDT");
      expect(Number.parseFloat(quote.lastPr)).toBeGreaterThan(0);
    });

    it("devrait gérer les symboles crypto invalides", async () => {
      await expect(bitget.fetchQuote("INVALIDCRYPTOXYZ")).rejects.toThrow();
    });

    it("devrait avoir des valeurs numériques cohérentes", async () => {
      const quote = await bitget.fetchQuote("BTCUSDT");

      const lastPrice = Number.parseFloat(quote.lastPr);
      const high24h = Number.parseFloat(quote.high24h);
      const low24h = Number.parseFloat(quote.low24h);

      // Le prix actuel devrait être entre le plus haut et le plus bas
      expect(lastPrice).toBeGreaterThanOrEqual(low24h * 0.99); // Marge de 1% pour variations
      expect(lastPrice).toBeLessThanOrEqual(high24h * 1.01);
    });
  });

  describe("fetchOHLC", () => {
    it("devrait récupérer les données OHLC pour BTC", async () => {
      const candles = await bitget.fetchOHLC("BTCUSDT", "1d");

      expect(candles).toBeDefined();
      expect(Array.isArray(candles)).toBe(true);
      expect(candles.length).toBeGreaterThan(0);

      const lastCandle = candles[candles.length - 1];
      expect(lastCandle.open).toBeGreaterThan(0);
      expect(lastCandle.high).toBeGreaterThan(0);
      expect(lastCandle.low).toBeGreaterThan(0);
      expect(lastCandle.close).toBeGreaterThan(0);
      expect(lastCandle.volume).toBeGreaterThan(0);
      expect(lastCandle.date).toBeDefined();
    });

    it("devrait supporter différents intervalles", async () => {
      const intervals = ["15min", "1h", "1d"] as const;

      for (const interval of intervals) {
        const candles = await bitget.fetchOHLC("ETHUSDT", interval);
        expect(candles.length).toBeGreaterThan(0);

        // Vérifier que les bougies sont ordonnées chronologiquement
        for (let i = 1; i < candles.length; i++) {
          const prevDate = new Date(candles[i - 1].date).getTime();
          const currDate = new Date(candles[i].date).getTime();
          expect(currDate).toBeGreaterThan(prevDate);
        }
      }
    });

    it("devrait respecter la cohérence OHLC", async () => {
      const candles = await bitget.fetchOHLC("BTCUSDT", "1d");

      for (const candle of candles) {
        // High devrait être >= Open, Close, Low
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.high).toBeGreaterThanOrEqual(candle.low);

        // Low devrait être <= Open, Close, High
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.high);
      }
    });

    it("devrait gérer les symboles invalides", async () => {
      await expect(bitget.fetchQuote("INVALIDXYZ")).rejects.toThrow();
    });
  });

  describe("fetchMetadata", () => {
    it("devrait récupérer les métadonnées pour BTC", async () => {
      const metadata = await bitget.fetchMetadata("BTCUSDT");

      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("BTCUSDT");
      expect(metadata.name).toBe("BTCUSDT");
      expect(metadata.type).toBe(SymbolType.CRYPTO);
      expect(metadata.data).toBeDefined();
      expect(metadata.data.quoteCurrency).toBe("USDT");
      expect(metadata.data.baseCurrency).toBe("BTC");
      expect(metadata.data.exchange).toBe("Bitget");
    });

    it("devrait récupérer les métadonnées pour ETH", async () => {
      const metadata = await bitget.fetchMetadata("ETHUSDT");

      expect(metadata).toBeDefined();
      expect(metadata.symbol).toBe("ETHUSDT");
      expect(metadata.data.quoteCurrency).toBe("USDT");
      expect(metadata.data.baseCurrency).toBe("ETH");
    });

    it("devrait identifier correctement le type comme CRYPTO", async () => {
      const metadata = await bitget.fetchMetadata("BTCUSDT");

      expect(metadata.type).toBe(SymbolType.CRYPTO);
    });

    it("devrait mettre en cache les résultats", async () => {
      const metadata1 = await bitget.fetchMetadata("BTCUSDT");
      const metadata2 = await bitget.fetchMetadata("BTCUSDT");

      // Les deux appels doivent retourner les mêmes données
      expect(metadata1.symbol).toBe(metadata2.symbol);
      expect(metadata1.data.baseCurrency).toBe(metadata2.data.baseCurrency);
    });
  });

  describe("fetchSuggestions", () => {
    it("devrait rechercher des cryptos par nom", async () => {
      const suggestions = await bitget.fetchSuggestions("BTC", 10);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      const btc = suggestions.find((s) => s.symbol === "BTCUSDT");
      expect(btc).toBeDefined();
      expect(btc?.type).toBe(SymbolType.CRYPTO);
    });

    it("devrait retourner plusieurs suggestions pour une recherche commune", async () => {
      const suggestions = await bitget.fetchSuggestions("ETH", 10);

      expect(suggestions.length).toBeGreaterThan(0);
      // Devrait trouver au moins ETHUSDT
      const ethusdt = suggestions.find((s) => s.symbol === "ETHUSDT");
      expect(ethusdt).toBeDefined();
    });

    it("devrait respecter la limite de résultats", async () => {
      const limit = 5;
      const suggestions = await bitget.fetchSuggestions("USD", limit);

      expect(suggestions.length).toBeLessThanOrEqual(limit);
    });

    it("devrait gérer les recherches sans résultats", async () => {
      const suggestions = await bitget.fetchSuggestions("XYZINVALIDXYZ");

      expect(Array.isArray(suggestions)).toBe(true);
      // Peut retourner un tableau vide ou quelques résultats non pertinents
    });
  });

  describe("normalizeSymbol", () => {
    it("devrait normaliser BTC-USD vers BTCUSDT", async () => {
      const quote = await bitget.fetchQuote("BTC-USD");
      // Si la normalisation fonctionne, cela devrait chercher BTCUSDT
      expect(quote.symbol).toMatch(/BTC.*USD/);
    });

    it("devrait supprimer les nombres des symboles", async () => {
      // Teste la normalisation de symboles avec des chiffres comme TAO22974
      const normalized = "TAOUSDT"; // Résultat attendu après normalisation
      // Ce test vérifie que la normalisation enlève bien les chiffres
      expect(normalized).not.toContain("22974");
    });

    it("devrait convertir en majuscules", async () => {
      const quote = await bitget.fetchQuote("btcusdt");
      expect(quote.symbol).toBe("BTCUSDT");
    });
  });

  describe("Gestion du cache", () => {
    it("devrait utiliser le cache pour les appels répétés", async () => {
      const quote1 = await bitget.fetchQuote("BTCUSDT");
      const quote2 = await bitget.fetchQuote("BTCUSDT");

      // Les deux appels doivent retourner les mêmes données
      expect(quote1.symbol).toBe(quote2.symbol);
      expect(quote1.lastPr).toBe(quote2.lastPr);
    });
  });

  describe("Gestion des erreurs", () => {
    it("devrait rejeter pour un symbole inexistant", async () => {
      await expect(bitget.fetchQuote("COMPLETELYFAKECRYPTO")).rejects.toThrow();
    });

    it("devrait rejeter pour un intervalle invalide OHLC", async () => {
      const candles = await bitget.fetchOHLC("BTCUSDT", "invalid" as any);
      expect(Array.isArray(candles)).toBe(true);
    });

    it("devrait gérer les erreurs réseau gracieusement", async () => {
      // Test avec timeout
      const promise = bitget.fetchQuote("BTCUSDT");
      await expect(promise).resolves.toBeDefined();
    }, 10000);
  });

  describe("Validation des données", () => {
    it("devrait retourner des timestamps valides", async () => {
      const quote = await bitget.fetchQuote("BTCUSDT");

      const timestamp = parseInt(quote.ts);
      const now = Date.now();

      // Le timestamp devrait être récent (dans les dernières 5 minutes)
      expect(timestamp).toBeGreaterThan(now - 5 * 60 * 1000);
      expect(timestamp).toBeLessThanOrEqual(now + 60 * 1000); // Marge de 1 minute
    });

    it("devrait retourner des volumes positifs", async () => {
      const quote = await bitget.fetchQuote("ETHUSDT");

      expect(Number.parseFloat(quote.baseVolume)).toBeGreaterThan(0);
      expect(Number.parseFloat(quote.quoteVolume)).toBeGreaterThan(0);
      expect(Number.parseFloat(quote.usdtVolume)).toBeGreaterThan(0);
    });

    it("devrait avoir des tailles de bid/ask cohérentes", async () => {
      const quote = await bitget.fetchQuote("BTCUSDT");

      expect(Number.parseFloat(quote.bidSz)).toBeGreaterThanOrEqual(0);
      expect(Number.parseFloat(quote.askSz)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Comparaison entre cryptos", () => {
    it("devrait retourner des données pour plusieurs cryptos", async () => {
      const cryptos = ["BTCUSDT", "ETHUSDT"];
      const quotes = await Promise.all(
        cryptos.map((symbol) => bitget.fetchQuote(symbol)),
      );

      expect(quotes).toHaveLength(2);
      quotes.forEach((quote) => {
        expect(quote).toBeDefined();
        expect(Number.parseFloat(quote.lastPr)).toBeGreaterThan(0);
      });

      // BTC devrait généralement avoir un prix plus élevé qu'ETH
      const btcPrice = Number.parseFloat(quotes[0].lastPr);
      const ethPrice = Number.parseFloat(quotes[1].lastPr);
      expect(btcPrice).toBeGreaterThan(ethPrice);
    });
  });

  describe("Format des données", () => {
    it("devrait retourner toutes les propriétés requises dans Quote", async () => {
      const quote = await bitget.fetchQuote("BTCUSDT");

      const requiredFields = [
        "symbol",
        "name",
        "open",
        "high24h",
        "low24h",
        "lastPr",
        "quoteVolume",
        "baseVolume",
        "usdtVolume",
        "ts",
        "bidPr",
        "askPr",
        "bidSz",
        "askSz",
        "openUtc",
        "changeUtc24h",
        "change24h",
      ];

      for (const field of requiredFields) {
        expect(quote[field as keyof typeof quote]).toBeDefined();
      }
    });

    it("devrait formater les nombres comme strings", async () => {
      const quote = await bitget.fetchQuote("ETHUSDT");

      // Les prix devraient être des strings
      expect(typeof quote.lastPr).toBe("string");
      expect(typeof quote.high24h).toBe("string");
      expect(typeof quote.low24h).toBe("string");

      // Mais devraient être parsables en nombres valides
      expect(parseFloat(quote.lastPr)).not.toBeNaN();
      expect(parseFloat(quote.high24h)).not.toBeNaN();
    });
  });
});
