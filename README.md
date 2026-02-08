# Screener App

Application TypeScript d'analyse technique et macro-économique pour les marchés financiers.

## 📌 Structure du projet

```
screener-app/
├── src/
│   ├── app/
│   │   └── analysis/         # Module d'analyse
│   │       ├── levels/       # Analyses multi-niveaux (Macro, AssetClass, Symbol)
│   │       ├── services/     # Services métier (AnalysisService, MacroService, DataService, ScreenerService)
│   │       ├── seeders/      # Scripts de migration et seed
│   │       └── scripts/      # Scripts d'exécution CLI
│   └── lib/
│       ├── cache.ts          # Système de cache dual (mémoire + DB)
│       ├── data/             # Providers de données (Yahoo Finance, Bitget)
│       │   ├── provider/     # Implémentations pures des providers
│       │   └── index.ts      # Exports des providers
│       └── prisma.ts         # Client Prisma ORM singleton
├── prisma/
│   ├── schema.prisma         # Schéma de base de données
│   └── seed.ts               # Script de seed (1133 symboles)
├── test/                     # Tests Vitest
└── test-functionnal/         # Tests fonctionnels TypeScript
```

## 🚀 Installation

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

## ⚙️ Configuration

Créez un fichier `.env` à la racine :

```env
# Base de données PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/screener"

# API FRED (optionnel - gratuit)
# https://fred.stlouisfed.org/docs/api/api_key.html
FRED_API_KEY="your_fred_api_key_here"

# FinancialModelingPrep API (recommandé pour listes/scan canadien)
# https://financialmodelingprep.com/developer/docs/
FMP_API_KEY="your_fmp_api_key_here"

# Notifications Telegram (optionnel)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
```

## ⚡ Cache Intelligent

Le système utilise un **cache dual** (mémoire + base de données) pour optimiser les performances :

- **Yahoo Finance** : 5 minutes (prix volatils)
- **Fear & Greed Index** : 1 heure (mises à jour quotidiennes)
- **Données FRED** : 1-6 heures (données économiques stables)

**Avantages** : Réduction drastique des appels API, respect des limites de taux, fonctionnement hors ligne partiel.

## 📊 Utilisation - Analyse Macro en temps réel

```typescript
import { analyzeMacroContextWithRealData } from "./src/app/analysis/index.js";

// Récupère les données macro réelles (FRED API + Yahoo Finance)
const macroAnalysis = await analyzeMacroContextWithRealData();

console.log("Régime macro :", macroAnalysis.regime.phase);
console.log("Biais sectoriels :", macroAnalysis.assetBias);
console.log("Source données :", macroAnalysis.metadata?.source);
// => "fred-api-real" si FRED_API_KEY configurée
// => "yahoo-finance-estimated" sinon
```

**Données récupérées automatiquement :**

- **FRED API** (si clé configurée) : ISM PMI, M2 Money Supply, Fed Funds Rate
- **Yahoo Finance** : VIX, S&P 500, DXY (Dollar Index), Gold
- **Fallback** : estimations basées sur prix de marché si API indisponible

## 📦 Scripts disponibles

- `npm run build` - Compile le projet TypeScript
- `npm run dev` - Exécute le code en mode développement
- `npm test` - Lance les tests en mode watch
- `npm run test:run` - Exécute les tests une seule fois

## Développement

Le projet est configuré avec :

- **TypeScript** pour le typage statique
- **Vitest** pour les tests unitaires
- **tsx** pour l'exécution rapide en développement

## Tests

Les tests sont situés dans le répertoire `test/` avec l'extension `.test.ts` et s'exécutent automatiquement avec Vitest.
