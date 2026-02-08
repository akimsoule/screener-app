# Screener App - API Documentation

## Architecture des Services

### Pattern de Conception

Tous les services suivent le pattern **Singleton Class** pour garantir la cohérence et éviter les instanciations multiples :

```typescript
class ServiceName {
  private static instance: ServiceName;

  private constructor() {
    // Initialisation privée
  }

  static getInstance(): ServiceName {
    if (!ServiceName.instance) {
      ServiceName.instance = new ServiceName();
    }
    return ServiceName.instance;
  }

  // Méthodes publiques
}
```

### Services Disponibles

#### 1. AnalysisService (Classe Singleton)

- **Responsabilité** : Analyse complète des symbols financiers
- **Méthodes principales** :
  - `analyzeSymbol()` : Analyse individuelle
  - `analyzeBatch()` : Analyse par lot
- **Dépendances** : MacroService, DataService

#### 2. MacroService (Classe Singleton)

- **Responsabilité** : Analyse macroéconomique et contexte de marché
- **Méthodes principales** :
  - `analyzeMacroContextWithRealData()` : Analyse avec données réelles
- **Dépendances** : DataService

#### 3. DataService (Classe Singleton)

- **Responsabilité** : Routage des données selon le type de symbole
- **Routing automatique** :
  - `CRYPTO` → BitgetProvider
  - `US_STOCK`, `CANADIAN_STOCK`, `INTERNATIONAL` → YahooProvider
- **Méthodes principales** :
  - `fetchQuote()` : Récupération des prix
  - `fetchMetadata()` : Récupération des métadonnées
  - `fetchSuggestions()` : Suggestions de recherche

#### 4. ScreenerService (Classe Singleton)

- **Responsabilité** : Screening complet des symbols actifs
- **Fonctionnalités** :
  - Récupération des symbols actifs
  - Analyse complète avec contexte macro
  - Filtrage dynamique
  - Pagination
  - Mise en cache (TTL: 15-30 min)

#### 5. FilterService (Classe Singleton)

- **Responsabilité** : Filtrage et tri des résultats d'analyse
- **Types de filtres** :
  - Booléens : Industry, Sector, Exchange, QuoteCurrency, SymbolType
  - Ranges : Dividend Yield, P/E Ratio, Market Cap, Score
  - Actions : BUY, STRONG_BUY, HOLD, SELL, STRONG_SELL

### Architecture en Couches

```
┌─────────────────┐
│   Scripts CLI   │ ← Points d'entrée utilisateur
├─────────────────┤
│   Services      │ ← Logique métier (Singletons)
├─────────────────┤
│   Levels        │ ← Logique pure d'analyse
├─────────────────┤
│   Providers     │ ← Accès aux données externes
├─────────────────┤
│   Cache/DB      │ ← Persistance et cache
└─────────────────┘
```

### Gestion des Erreurs

- **AnalysisError** : Table dédiée pour tracer les erreurs d'analyse
- **Logger** : Système de logging centralisé
- **Cache** : Cache mémoire + DB pour la performance

### Tests

- **Unitaires** : Vitest pour les services et utilitaires
- **Fonctionnels** : Scripts TypeScript pour validation end-to-end

## Services Implémentés

Tous les services spécifiés dans `.github/copilot-instructions.md` ont été implémentés avec succès.

### 🎯 Services Métier

#### 1. ScreenerService (`src/app/analysis/services/screenerService.ts`)

Service principal d'analyse qui screene tous les symbols actifs avec :

- Intégration du contexte macro
- Filtres dynamiques (booléens et ranges)
- Pagination
- Analyse en batch avec optimisation
- Enrichissement avec quotes en temps réel

#### 2. SymbolService (`src/app/analysis/services/symbolService.ts`)

Gestion des symboles :

- Ajout de nouveaux symbols avec fetchMetadata()
- Vérification d'existence
- Mise à jour des métadonnées
- Activation/désactivation
- Soft/hard delete

#### 3. FilterService (étendu dans `src/app/analysis/services/filterService.ts`)

Nouvelle méthode :

- `getAvailableFilters()` - Retourne tous les filtres disponibles avec ranges

### 🌐 API Endpoints

Le serveur REST est dans `src/api/server.ts` avec les routes définies dans `src/api/routes.ts`

#### Démarrer le serveur

```bash
npm run server
```

#### Endpoints disponibles

##### 1. GET `/api/screener`

Service principal de screening avec filtres et pagination

**Query Parameters:**

- `page` (default: 1) - Numéro de page
- `limit` (default: 10) - Éléments par page
- **Filtres booléens** : `symbolType`, `sector`, `industry`, `exchange`, `quoteCurrency`
- **Filtres numériques** : `dividendYieldMin/Max`, `peRatioMin/Max`, `marketCapMin/Max`, `scoreMin/Max`
- **Filtre action** : `action` (STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL)

**Exemple:**

```bash
curl "http://localhost:3000/api/screener?page=1&limit=10&sector=Technology&scoreMin=60&action=BUY,STRONG_BUY"
```

##### 2. GET `/api/macro/analysis`

Analyse macroéconomique actuelle

**Exemple:**

```bash
curl "http://localhost:3000/api/macro/analysis"
```

##### 3. GET `/api/filters/available`

Retourne tous les filtres disponibles avec leurs valeurs possibles

**Exemple:**

```bash
curl "http://localhost:3000/api/filters/available"
```

##### 4. GET `/api/suggestions?query=apple&type=us_stocks`

Suggestions de symboles

**Query Parameters:**

- `query` (required) - Texte de recherche
- `type` (default: us_stocks) - Type: crypto, us_stocks, canadian_stocks, international_stocks
- `limit` (default: 20) - Nombre max de suggestions

**Exemple:**

```bash
curl "http://localhost:3000/api/suggestions?query=apple&type=us_stocks&limit=10"
```

##### 5. POST `/api/symbols`

Ajouter un nouveau symbol

**Body:**

```json
{
  "symbolName": "AAPL",
  "symbolType": "US_STOCK"
}
```

**Exemple:**

```bash
curl -X POST http://localhost:3000/api/symbols \
  -H "Content-Type: application/json" \
  -d '{"symbolName":"AAPL","symbolType":"US_STOCK"}'
```

##### 6. DELETE `/api/symbols/:symbolName`

Désactiver un symbol (soft delete)

**Exemple:**

```bash
curl -X DELETE http://localhost:3000/api/symbols/AAPL
```

##### 7. GET `/api/symbols/:symbolName`

Récupérer un symbol spécifique

**Exemple:**

```bash
curl "http://localhost:3000/api/symbols/AAPL"
```

##### 8. GET `/health`

Health check du serveur

**Exemple:**

```bash
curl "http://localhost:3000/health"
```

## Architecture

```
src/
├── api/
│   ├── server.ts          # Serveur Express
│   └── routes.ts          # Routes REST
├── app/analysis/services/
│   ├── screenerService.ts # Service principal de screening
│   ├── symbolService.ts   # Gestion des symbols
│   ├── filterService.ts   # Filtrage (étendu avec getAvailableFilters)
│   ├── macroService.ts    # Analyse macro (existant)
│   └── analysisService.ts # Analyse technique (existant)
└── lib/
    └── data/
        └── index.ts       # fetchSuggestions, fetchMetadata, fetchQuote
```

## Stack Technique

- ✅ Express.js - Framework REST
- ✅ Prisma - ORM pour PostgreSQL
- ✅ TypeScript - Typage fort
- ✅ Services existants réutilisés (analysisService, macroService, filterService)

## Prochaines Étapes

- [ ] Validation des inputs avec Zod
- [ ] Documentation OpenAPI/Swagger
- [ ] Rate limiting
- [ ] Authentication/Authorization
- [ ] Tests d'intégration API
- [ ] Logs structurés
- [ ] Métriques et monitoring
