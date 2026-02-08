# Scripts de Test Fonctionnel

Scripts utiles pour le debug et la vérification fonctionnelle de l'application.

## Scripts de Vérification Cache

### `check-cache.ts`

Vérifie les entrées de cache pour un symbole spécifique (AAPL par défaut).

```bash
tsx test-functionnal/check-cache.ts
```

## Scripts de Vérification Données

### `check-data-freshness.mjs`

Vérifie la fraîcheur des données quotidiennes pour un symbole.

```bash
node test-functionnal/check-data-freshness.mjs
```

### `check-intraday.mjs`

Vérifie les données intraday (5 minutes) pour un symbole.

```bash
node test-functionnal/check-intraday.mjs
```

### `check-metadata.ts`

Vérifie les métadonnées stockées en base pour plusieurs symboles.

```bash
tsx test-functionnal/check-metadata.ts
```

### `check-symbols.mjs`

Liste tous les symboles populaires et actifs dans la base de données.

```bash
node test-functionnal/check-symbols.mjs
```

## Scripts de Test Crypto

### `check-crypto-mapping.ts`

Vérifie la correspondance et disponibilité des symboles crypto sur Bitget.

```bash
tsx test-functionnal/check-crypto-mapping.ts
```

### `test-bitget-quote.mjs`

Test simple de récupération de quotes via Bitget pour BTC et ETH.

```bash
node test-functionnal/test-bitget-quote.mjs
```

## Scripts de Test Yahoo Finance

### `test-fetch-aapl.ts`

Test de récupération de métadonnées pour AAPL via fetchMetadata.

```bash
tsx test-functionnal/test-fetch-aapl.ts
```

### `test-fetch-metadata.ts`

Test de récupération directe de métadonnées via le provider Yahoo.

```bash
tsx test-functionnal/test-fetch-metadata.ts
```

### `test-yahoo-chart.ts`

Test de l'API Chart de Yahoo Finance (données de prix).

```bash
tsx test-functionnal/test-yahoo-chart.ts
```

### `test-yahoo-metadata.ts`

Test de l'API QuoteSummary de Yahoo Finance (métadonnées détaillées).

```bash
tsx test-functionnal/test-yahoo-metadata.ts
```

### `test-yf2.ts`

Test avec la bibliothèque yahoo-finance2 pour AAPL.

```bash
tsx test-functionnal/test-yf2.ts
```

## Notes

- Tous les scripts incluent `process.exit(0)` pour terminer proprement
- Les imports ont été ajustés pour refléter leur nouvel emplacement (`../src/...`)
- Ces scripts sont principalement utilisés pour le debug et ne font pas partie de la suite de tests automatisés
