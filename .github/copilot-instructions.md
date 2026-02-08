# Services à implémenter pour le Screener App

> **ℹ️ Note Architecture** : L'architecture a été refactorisée pour uniformiser tous les services selon le pattern **Singleton Class**. Les services existants (`AnalysisService`, `MacroService`, `DataService`, etc.) sont maintenant des classes singleton avec des méthodes d'instance au lieu de fonctions exportées.

## Contexte

- Le **Screener** est l'outil principal d'analyse de l'application
- Il analyse **tous les symbols actifs** (`enabled=true`) de la base de données
- Chaque symbol est analysé via `analysisService` pour obtenir un score et une recommandation
- Le contexte macroéconomique (`macroService`) influence l'analyse et les recommandations
- Les résultats sont filtrables dynamiquement et paginés pour l'affichage UI

## Services à implémenter

### 1. Service de Screener (PRIORITAIRE - Le plus complexe)

**Endpoint** : `GET /api/screener`

**Fonctionnalités** :

- Récupérer tous les symbols actifs (`enabled=true`) de la DB
- Pour chaque symbol, exécuter une analyse complète :
  - Récupérer le contexte macro actuel via `analyzeMacroContextWithRealData()`
  - Analyser le symbol avec `analysisService` en tenant compte du régime macro
  - Calculer score, recommandation (`STRONG_BUY`, `BUY`, `HOLD`, `SELL`, `STRONG_SELL`)
  - Récupérer la quote en temps réel via `fetchQuote()`
- Appliquer les filtres dynamiques sur les résultats
- Paginer les résultats
- Mettre en cache les résultats pour performance (TTL: 15-30 minutes)

**Filtres dynamiques** :

- **Filtres booléens** (checkbox) : Industry, Sector, Exchange, QuoteCurrency, SymbolType
  - Ex: `?industry=Automobile&sector=Technology` → filtre avec logique **OR**
- **Filtres par range** : Dividend Yield, P/E Ratio, Market Cap, Score
  - Ex: `?dividendYieldMin=2&dividendYieldMax=5&scoreMin=60`
- **Filtre par action recommandée** : `?action=BUY,STRONG_BUY`
- **Logique** : Quand plusieurs filtres sont sélectionnés, l'effet est **OR** (union, pas intersection)

**Pagination** :

- Par défaut : 10 éléments par page
- Paramètres : `?page=1&limit=10`

**Exemple de réponse** :

```json
{
  "data": [
    {
      "id": "clxxx",
      "name": "AWAT.PA",
      "symbolType": "INTERNATIONAL",
      "provider": "yahoo",
      "enabled": true,
      "metadata": {
        "data": {
          "sector": "Technology",
          "industry": "Semiconductors",
          "exchange": "PAR",
          "marketCap": 1234567890
        }
      },
      "quote": {
        "price": 32.68,
        "change": 0.45,
        "changePercent": 1.4
      },
      "analysis": {
        "symbol": "AWAT.PA",
        "timestamp": "2026-02-07T06:38:02.222Z",
        "regime": "WEAK_TREND",
        "rawScore": 98,
        "score": 82,
        "action": "🟢 STRONG_BUY",
        "confidence": 82,
        "interpretation": "✅ Setup premium : tendance, momentum et structure alignés.",
        "riskFlags": [],
        "details": {
          "price": 32.68,
          "rsi": 67.16,
          "adx": 21.41,
          "trendDaily": "BULL",
          "trendWeekly": "BULL",
          "atr": 0.38,
          "atrPercent": 1.17,
          "volatilityRegime": "NORMAL"
        },
        "recommendation": {
          "side": "LONG",
          "entry": 32.68,
          "stopLoss": 31.99,
          "takeProfit": 34.74,
          "riskReward": 3,
          "sizing": {
            "units": 1456,
            "positionSizeUSD": 47580.63,
            "riskAmountUSD": 1000,
            "riskPercent": 1,
            "kellyFraction": 0.05
          },
          "rationale": "✅ Trade autorisé | Risque: 1.00% | Kelly: 5.00%",
          "holdingPeriod": {
            "min": 14,
            "max": 56,
            "target": 28,
            "description": "Position trading (1-2 mois)"
          }
        },
        "metrics": {
          "winRateEstimate": 68,
          "expectancy": 1.41,
          "maxAdverseExcursion": 0.95
        }
      },
      "analyzedAt": "2026-02-07T06:38:02.222Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 145,
    "totalPages": 15
  },
  "appliedFilters": {
    "industry": ["Semiconductors", "Software"],
    "scoreMin": 60,
    "action": ["STRONG_BUY", "BUY"]
  },
  "macroContext": {
    "regime": {
      "type": "GROWTH",
      "confidence": 0.85
    },
    "timestamp": "2026-02-07T06:38:00Z"
  }
}
```

---

### 2. Service d'Analyse Macroéconomique

**Endpoint** : `GET /api/macro/analysis`

**Fonctionnalités** :

- Retourner l'analyse macroéconomique du marché (déjà implémenté dans `macroService.ts`)
- Utiliser `analyzeMacroContextWithRealData()` qui inclut :
  - Régime macro détecté (GROWTH, STAGFLATION, etc.)
  - Biais sectoriels (tech, value, defensive, etc.)
  - Insights enrichis avec Fear & Greed Index
  - Niveau de confiance

**Exemple de réponse** :

```json
{
  "regime": {
    "type": "GROWTH",
    "confidence": 0.85,
    "description": "Croissance économique soutenue"
  },
  "assetBias": {
    "tech": 0.8,
    "value": 0.3,
    "defensive": 0.2
  },
  "insights": [
    "🎭 Fear & Greed: Greed (72/100) - Sentiment haussier modéré",
    "📊 Favoriser les secteurs cycliques"
  ],
  "metadata": {
    "source": "yahoo-finance",
    "timestamp": "2026-02-07T10:00:00Z"
  }
}
```

---

### 3. Service de Filtres Disponibles

**Endpoint** : `GET /api/filters/available`

**Fonctionnalités** :

- Analyser les `metadata` de tous les symbols actifs (`enabled=true`) dans la DB
- Retourner les valeurs uniques pour chaque filtre disponible
- Calculer les ranges (min/max) pour les filtres numériques

**Exemple de réponse** :

```json
{
  "booleanFilters": {
    "symbolType": ["US_STOCK", "CRYPTO", "CANADIAN_STOCK"],
    "sector": ["Technology", "Healthcare", "Finance", "Energy"],
    "industry": ["Semiconductors", "Biotechnology", "Banks"],
    "exchange": ["NASDAQ", "NYSE", "TSX"],
    "quoteCurrency": ["USD", "CAD"]
  },
  "rangeFilters": {
    "dividendYield": { "min": 0, "max": 8.5, "unit": "%" },
    "peRatio": { "min": 5, "max": 150 },
    "marketCap": { "min": 1000000, "max": 3000000000000, "unit": "USD" }
  }
}
```

---

### 4. Service de Suggestions

**Endpoint** : `GET /api/suggestions?query=apple&type=us_stocks`

**Fonctionnalités** :

- Utiliser `fetchSuggestions()` déjà implémenté dans `src/lib/data/index.ts`
- **IMPORTANT** : Tenir compte du routage par type de symbole :
  - `CRYPTO` → Provider Bitget
  - `US_STOCK`, `CANADIAN_STOCK`, `INTERNATIONAL` → Provider Yahoo Finance
- Limiter à 10-20 suggestions par défaut

**Paramètres** :

- `query` : Texte de recherche (ex: "apple", "btc")
- `type` : Type de symbole (`crypto`, `us_stocks`, `canadian_stocks`, `international_stocks`)

**Exemple de réponse** :

```json
{
  "suggestions": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "type": "US_STOCK"
    },
    {
      "symbol": "APLE",
      "name": "Apple Hospitality REIT",
      "exchange": "NYSE",
      "type": "US_STOCK"
    }
  ]
}
```

---

### 5. Service d'Ajout de Symbols

**Endpoint** : `POST /api/symbols`

**Fonctionnalités** :

1. Vérifier si le symbol existe déjà dans la table `Symbol` (via `name`)
2. Si non, créer le symbol avec `fetchMetadata()` pour enrichir les données
3. Définir `enabled=true` pour qu'il soit inclus dans le screener
4. Retourner le symbol créé avec métadonnées complètes

**Exemple requête** :

```json
POST /api/symbols
{
  "symbolName": "AAPL",
  "symbolType": "US_STOCK"
}
```

**Exemple réponse** :

```json
{
  "success": true,
  "symbol": {
    "id": "clxxx",
    "name": "AAPL",
    "symbolType": "US_STOCK",
    "provider": "yahoo",
    "enabled": true,
    "metadata": { ... },
    "createdAt": "2026-02-07T10:00:00Z"
  }
}
```

---

## Architecture technique

### Services existants à utiliser

- ✅ `analysisService.ts` - Service d'analyse des symbols (`analyzeSymbolService`, `analyzeBatchService`)
- ✅ `macroService.ts` - Analyse macro (`analyzeMacroContextWithRealData()`)
- ✅ `filterService.ts` - Filtrage par metadata (à étendre avec pagination)
- ✅ `fetchSuggestions()` dans `src/lib/data/index.ts` - Suggestions avec routage
- ✅ `fetchQuote()` - Récupération des quotes en temps réel
- ✅ `fetchMetadata()` - Enrichissement des symboles

### Nouveaux services à créer

- `screenerService.ts` - Service principal de screening (PRIORITAIRE)
  - Orchestration de l'analyse de tous les symbols actifs
  - Intégration du contexte macro dans l'analyse
  - Application des filtres dynamiques via `filterService`
  - Pagination des résultats
  - Mise en cache des résultats (TTL: 15-30 min)
  - Enrichissement avec quotes en temps réel
- Endpoints API (REST ou GraphQL selon préférence)

### Stack suggéré

- Framework API : Express, Fastify ou tRPC
- ORM : Prisma (déjà configuré)
- Validation : Zod ou Joi
- Documentation : Swagger/OpenAPI
