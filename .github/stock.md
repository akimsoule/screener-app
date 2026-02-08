# Projet : Scanner de Penny Stocks Canadiens (Optimisé Wealthsimple)

# Stack : TypeScript, Node.js, Axios, p-limit

## Objectif

Développer un scanner de marché qui identifie les "Penny Stocks" à haut potentiel sur les bourses canadiennes (TSX et TSXV). L'objectif est de trouver des opportunités pour une stratégie de trading sans commission sur Wealthsimple.

**Définition Penny Stock Canadien :**

- Actions cotées sur TSX (Toronto Stock Exchange) ou TSXV (TSX Venture Exchange)
- Prix de l'action ≤ 0,50$ CAD
- Capitalisation boursière généralement < 100M$ CAD
- Forte volatilité et potentiel de croissance élevé

## 1. Sources de Données

- **Liste des Symboles** : Récupérer via l'API Finnhub (`/stock/symbol?exchange=TO` et `exchange=V`). ✅ **Implémenté** - Le scanner utilise maintenant `fetchSymbolsFromFinnhub()` avec fallback vers symboles connus.
- **Données Temps Réel** : Utiliser Twelve Data ou Yahoo Finance pour obtenir le Prix, le Volume actuel et le Volume Moyen (30j).
- **Métadonnées** : Récupérer automatiquement depuis la base de données (sector, industry, marketCap, exchange, currency).
- **Cache** : Système dual mémoire/DB pour optimiser les performances et réduire les coûts API.

## 2. Logique de Filtrage (Cœur du Scanner)

Le script doit itérer sur chaque symbole et ne conserver que ceux qui respectent TOUS les critères suivants :

### A. Filtres Statiques

- **Marchés** : Uniquement les suffixes `.TO` (Toronto) et `.V` (Venture).
- **Type d'Actif** : `Common Stock` uniquement (Exclure les ETF, Fonds, Warrants, Actions privilégiées).
- **Fourchette de Prix** : $0,05 <= prix <= 0,50$ (CAD).
- **Classification Penny Stock Canadien** : Actions cotées sur TSX/TSXV avec prix ≤ 0,50$ CAD et capitalisation < 100M$ (critères officiels des penny stocks canadiens).

### B. Filtres de Liquidité

- **Volume Dollar Quotidien** : `(Volume_Moyen_30j * Prix_Actuel)` doit être > 50 000 $ CAD.
- **Capitalisation Boursière** : Doit être < 100M $ CAD (Petites capitalisations pour une volatilité maximale).

### C. Signal Dynamique (Détection d'Anomalies)

- **Volume Relatif (RVOL)** : `Volume_Actuel / Volume_Moyen_30j`.
- **Seuil** : Le RVOL doit être > 2.0 (L'action s'échange à 2x son volume normal).
- **Vérification du Spread** : `(Ask - Bid) / Bid` doit être < 0.05 (Éviter les pièges illiquides).

## 3. Contraintes Techniques

- Utiliser des **interfaces TypeScript** pour toutes les réponses d'API.
- Implémenter le **Rate Limiting** : Utiliser la librairie `p-limit` pour limiter à 5 requêtes simultanées maximum (éviter les erreurs 429).
- **Système de Cache** : Intégrer le cache dual (mémoire + DB) pour optimiser les performances et réduire les appels API.
- **Enrichissement Métadonnées** : Récupérer automatiquement les métadonnées (sector, industry, marketCap) depuis la base de données.
- **Tri** : La sortie finale doit être un tableau JSON d'objets, trié par `RVOL` par ordre décroissant.

## 4. Format de Sortie Attendu

```typescript
interface ScannedStock {
  ticker: string;
  price: number;
  rVol: number;
  dailyDollarVolume: number;
  spread: number;
  timestamp: string;
  // Métadonnées enrichies depuis la DB
  metadata: {
    sector: string;
    industry: string;
    marketCap: number;
    exchange: string;
    currency: string;
  };
  // Indicateur de cache
  cached: boolean;
}
```

### Système de Cache et Métadonnées

Le scanner utilise le **système de cache dual** de l'application :

- **Cache Mémoire** : Données volatiles (prix, volume) - TTL 5 minutes
- **Cache DB** : Métadonnées persistantes (sector, industry, marketCap) - TTL 24h
- **Indicateur `cached`** : `true` si les données viennent du cache, `false` si appel API frais

**Avantages :**

- ⚡ **Performance** : Réduction drastique des appels API
- 💰 **Économie** : Respect des limites de taux des APIs gratuites
- 📊 **Enrichissement** : Métadonnées complètes pour chaque symbole
- 🔄 **Fiabilité** : Fonctionnement hors ligne partiel

### Exemple de Sortie

```json
[
  {
    "ticker": "ABC.V",
    "price": 0.25,
    "rVol": 3.2,
    "dailyDollarVolume": 75000,
    "spread": 0.02,
    "timestamp": "2026-02-07T15:30:00Z",
    "metadata": {
      "sector": "Technology",
      "industry": "Software",
      "marketCap": 25000000,
      "exchange": "TSXV",
      "currency": "CAD"
    },
    "cached": false
  }
]
```

### Pourquoi ce fichier est efficace pour Copilot :

- **Contexte métier** : Il définit clairement pourquoi on fait ce script (Wealthsimple = pas de frais sur le CAD).
- **Typage strict** : En lui donnant l'interface `ScannedStock`, il va générer du code qui respecte cette structure.
- **Gestion d'erreurs** : La mention de `p-limit` et des erreurs `429` force Copilot à écrire un code asynchrone robuste plutôt qu'une simple boucle `for` qui ferait planter l'API.

### Prochaine étape pour toi :

Une fois que Copilot a généré le scanner, il te faudra gérer le stockage de ces résultats. **Est-ce que tu veux que je te prépare le fichier `package.json` avec les commandes de build pour lancer ton scanner en une ligne ?**
