# 🌍 Service d'Analyse Macroéconomique

Service de récupération et analyse des données macroéconomiques en temps réel depuis **FRED API** (Federal Reserve Economic Data) et **Yahoo Finance**.

> **ℹ️ Note Architecture** : Le MacroService suit désormais le pattern **Singleton Class** pour une meilleure cohérence avec les autres services de l'application.

## 📊 Vue d'ensemble

Le service macro fournit :

- **Régime macro détecté** : RISK_ON / RISK_OFF / TRANSITION
- **Cycle économique** : EARLY / MID / LATE / RECESSION
- **Politique Fed** : CUTTING / PAUSING / HIKING
- **Biais par classe d'actifs** : Actions, Crypto, Obligations, Matières premières, Forex

## 🔑 Configuration (Optionnel mais recommandé)

### 1. Obtenir une clé API FRED (gratuite)

```bash
# 1. Créer un compte : https://fred.stlouisfed.org/
# 2. Obtenir une clé API : https://fred.stlouisfed.org/docs/api/api_key.html
# 3. Ajouter au .env

FRED_API_KEY="votre_cle_api_fred_ici"
```

### 2. Données récupérées

| Source             | Données                 | Utilisation                             |
| ------------------ | ----------------------- | --------------------------------------- |
| **FRED API**       | ISM PMI (MANEMP)        | Indicateur de croissance manufacturière |
|                    | M2 Money Supply (M2SL)  | Masse monétaire (liquidité)             |
|                    | Fed Funds Rate (DFF)    | Taux directeur de la Fed                |
| **Yahoo Finance**  | VIX                     | Volatilité / Risk-off indicator         |
|                    | S&P 500 (SPY)           | Sentiment actions US                    |
|                    | Dollar Index (DX-Y.NYB) | Force du dollar                         |
|                    | Gold (GLD)              | Safe haven / inflation hedge            |
| **Alternative.me** | Fear & Greed Index      | Sentiment crypto (0-100)                |

## 🚀 Cache Intelligent

Le service utilise un **système de cache dual** (mémoire + base de données) pour optimiser les performances :

| Source            | TTL      | Raison                      |
| ----------------- | -------- | --------------------------- |
| **Yahoo Finance** | 5 min    | Prix de marché volatils     |
| **Fear & Greed**  | 1 heure  | Mis à jour quotidiennement  |
| **FRED API**      | 1 heure  | Données économiques stables |
| **FRED YoY**      | 6 heures | Calculs basés sur 13 points |

**Avantages :**

- ⚡ **Performance** : Réduction drastique des appels API
- 💰 **Économie** : Respect des limites de taux des APIs gratuites
- 🔄 **Fiabilité** : Fonctionnement hors ligne partiel
- 📊 **Logs** : Indicateurs visuels `(cache)` vs appels API

## 📦 Utilisation

### Exemple 1 : Analyse macro simple

```typescript
import { analyzeMacroContextWithRealData } from "./src/app/analysis/index.js";

const macroAnalysis = await analyzeMacroContextWithRealData();

console.log(macroAnalysis.regime.phase); // RISK_ON
console.log(macroAnalysis.assetBias.crypto); // 20.00 (bullish)
console.log(macroAnalysis.metadata?.source); // "fred-api-real"
```

### Exemple 2 : Script complet

```bash
# Lancer l'analyse macro
npx tsx src/app/analysis/scripts/runMacroAnalysis.ts
```

**Sortie console :**

```
🌍 ANALYSE MACRO EN TEMPS RÉEL
════════════════════════════════════════════════════════════

📊 RÉGIME MACRO DÉTECTÉ
────────────────────────────────────────────────────────────
Phase           : RISK_ON
Cycle           : MID_CYCLE
Politique Fed   : PAUSING
Confiance       : 5000.0%

💰 BIAIS PAR CLASSE D'ACTIFS
────────────────────────────────────────────────────────────
Actions         : 15.00
Crypto          : 20.00
Obligations     : -5.00
Matières 1ères  : 10.00
Forex (USD)     : 0.00

💡 INSIGHTS
────────────────────────────────────────────────────────────
  📈 Environnement RISK-ON détecté : favorable aux actifs risqués
  📊 MID CYCLE : expansion en cours, maintenir l'exposition
  🏦 Fed en mode PAUSING : politique monétaire stable

🔍 MÉTADONNÉES
────────────────────────────────────────────────────────────
Source          : fred-api-real
FRED API        : ✅ Disponible
Timestamp       : 05/02/2026 23:16:11

Données marché :
  VIX           : 21.77
  S&P 500 (1j)  : -1.25%
  Or (1j)       : -2.66%
  Fed Funds     : 3.64%

🎭 Fear & Greed Index (Crypto) :
  Score         : 9/100
  Classification: Extreme Fear
  Interprétation: Extreme Fear - Opportunité d'achat potentielle
```

### Cache en action

**Première exécution** (appels API) :

```
🎭 Fear & Greed Index: 9/100 (Extreme Fear)
📊 FRED MANEMP: 12692
📊 FRED M2SL YoY: 4.60%
📊 FRED DFF: 3.64
```

**Exécutions suivantes** (cache) :

```
🎭 Fear & Greed Index (cache)
📊 FRED MANEMP (cache)
📊 FRED M2SL YoY (cache)
📊 FRED DFF (cache)
```

### Exemple 3 : Intégration dans votre code

```typescript
import { analyzeMacroContextWithRealData } from "./src/app/analysis/index.js";

async function shouldBuyRiskyAssets() {
  const macro = await analyzeMacroContextWithRealData();

  // Logique de décision
  if (macro.regime.phase === "RISK_ON" && macro.assetBias.crypto > 15) {
    return {
      decision: "BUY",
      reason: "Environnement favorable aux actifs risqués",
    };
  }

  if (macro.regime.phase === "RISK_OFF") {
    return {
      decision: "SELL",
      reason: "Réduire exposition aux actifs risqués",
    };
  }

  return { decision: "HOLD", reason: "Signaux mixtes" };
}
```

## 🔄 Fallback & Graceful Degradation

Le service fonctionne **même sans clé FRED API** :

| Scénario                | Source               | Qualité                                   |
| ----------------------- | -------------------- | ----------------------------------------- |
| ✅ FRED_API_KEY définie | FRED + Yahoo Finance | **Production** (données officielles)      |
| ⚠️ Pas de FRED_API_KEY  | Yahoo Finance seul   | **Estimations** basées sur prix de marché |
| ❌ Erreur API complète  | Fallback démo        | **Valeurs par défaut**                    |

### Métadonnées de qualité

```typescript
const macro = await analyzeMacroContextWithRealData();

// Vérifier la qualité des données
switch (macro.metadata?.source) {
  case "fred-api-real":
    console.log("✅ Données officielles FRED + Yahoo");
    break;
  case "yahoo-finance-estimated":
    console.log("⚠️ Estimations basées sur prix de marché");
    break;
  case "fallback-demo":
    console.log("❌ Erreur API - valeurs de démo");
    break;
}
```

## 🧪 Tests

```bash
# Test manuel
npx tsx src/app/analysis/scripts/runMacroAnalysis.ts

# Test avec cache désactivé
rm -rf .cache && npx tsx src/app/analysis/scripts/runMacroAnalysis.ts
```

## 🏗️ Architecture

```
src/app/analysis/services/
├── macroService.ts         # Service principal (analyse macro)
└── macroDataService.ts     # Récupération données (FRED + Yahoo)

Flux de données :
1. fetchRealMacroData()          → Récupère données FRED + Yahoo
2. analyzeMacroContext()         → Détecte régime macro
3. calculateAssetClassBias()     → Calcule biais sectoriels
4. generateMacroInsights()       → Génère insights textuels
```

## 📖 API Reference

### `analyzeMacroContextWithRealData()`

Récupère et analyse les données macro en temps réel.

**Retour :**

```typescript
{
  regime: {
    phase: "RISK_ON" | "RISK_OFF" | "TRANSITION",
    cycleStage: "EARLY_CYCLE" | "MID_CYCLE" | "LATE_CYCLE" | "RECESSION",
    fedPolicy: "CUTTING" | "PAUSING" | "HAWKISH_PAUSE" | "HIKING",
    dollarRegime: "WEAK" | "NEUTRAL" | "STRENGTHENING",
    liquidity: "EXPANDING" | "NEUTRAL" | "CONTRACTING",
    confidence: number  // 0-1 (0.8 = 80%)
  },
  assetBias: {
    equities: number,     // -50 à +50 (bearish → bullish)
    crypto: number,
    bonds: number,
    commodities: number,
    forex: number
  },
  insights: string[],     // Insights textuels
  metadata: {
    source: "fred-api-real" | "yahoo-finance-estimated" | "fallback-demo",
    timestamp: string,
    fredApiAvailable: boolean,
    vix: number,
    spyChange: number,
    goldChange: number,
    fedFundsRate: number
  }
}
```

## 🚨 Erreurs courantes

### 1. FRED API rate limit

```
FRED API error for MANEMP: 429
```

**Solution :** Réessayer plus tard (limite : 120 requêtes/minute)

### 2. Yahoo Finance timeout

```
Failed to fetch quote for ^VIX: Network error
```

**Solution :** Le service utilise le cache automatiquement (5 min TTL)

### 3. Pas de FRED_API_KEY

```
Note: Estimations basées sur prix de marché (FRED_API_KEY manquante)
```

**Solution :** Ajouter `FRED_API_KEY` au `.env` pour des données officielles

## 📚 Ressources

- [FRED API Documentation](https://fred.stlouisfed.org/docs/api/)
- [Yahoo Finance API (Unofficial)](https://github.com/ranaroussi/yfinance)
- [ISM PMI (MANEMP)](https://fred.stlouisfed.org/series/MANEMP)
- [M2 Money Supply](https://fred.stlouisfed.org/series/M2SL)
- [Fed Funds Rate](https://fred.stlouisfed.org/series/DFF)
