# 🚀 Déployer l'application API sur Netlify (Serverless + Scheduled Functions)

Ce document décrit les étapes **pratiques** pour déployer l'API (fonctions Netlify) et configurer les tâches planifiées (cron) via **Netlify Scheduled Functions** (toutes les 15 minutes). La partie web (React / Vite) a été retirée de ce projet — l'application est uniquement serveur/API.

---

## 🧰 Résumé (Quick overview)

- Hosting: **Netlify Functions** (serverless)
- API: endpoints à exposer (REST JSON)
- Cron: tâches planifiées toutes les 15 min via **Netlify Scheduled Functions**

---

## 📂 Structure recommandée

- /src/app — code métier, services et scripts (Node/TS)
- /netlify/functions — fonctions serverless exposées par Netlify
- /docs — guides et instructions (ce fichier)

---

## ✅ Endpoints à exposer (Principaux services)

Documenter les comportements et contraintes de chaque service :

- GET /watchlist
  - Description : retourne la watchlist (symboles et métadonnées) avec support des **filtres** et de la **pagination**.
  - IMPORTANT : cette route **doit être servie depuis le cache** (clé `watchlist`) pour des raisons de performance. TTL recommandé : **15 minutes** (configurable via une constante). Le cache doit être invalidé/rafraîchi lors d'un `PUT /symbol` ou lorsque la watchlist est modifiée.
  - Paramètres de requête pris en charge :
    - `page` (optionnel, défaut: 1)
    - `limit` (optionnel, défaut: 10)
    - Filtres booléens (sélection multiple possible, logique **OR**) : `industry`, `sector`, `exchange`, `quoteCurrency`, `symbolType`
    - Filtres par range : `dividendYieldMin`, `dividendYieldMax`, `peMin`, `peMax`, `marketCapMin`, `marketCapMax`, `scoreMin`, `scoreMax`
    - Exemple : `GET /watchlist?page=1&limit=20&industry=Semiconductors&scoreMin=60`
  - Logique de filtrage : utiliser la même logique que `displayFilters` (`src/scripts/displayFilters.ts`) et `filterService` (`src/app/analysis/services/filterService.ts`). Quand plusieurs valeurs sont sélectionnées pour un même filtre, appliquer une logique **OR** (union, pas intersection).
  - Réponse : JSON { "data": [ { "symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "quote": {...}, "analysis": {...} } ], "pagination": { "page": 1, "limit": 10, "total": 145, "totalPages": 15 }, "appliedFilters": { "industry": ["Semiconductors"], "scoreMin": 60 }, "cached": true, "cacheTs": "2026-02-07T10:00:00Z" }

- GET /pennystocks
  - Description : retourne la liste des penny stocks analysés / scannés (symboles et métadonnées).
  - IMPORTANT : cette route **doit être servie depuis le cache** (clé `pennystocks`) pour des raisons de performance. TTL recommandé : **15 minutes** (configurable). Le cache doit être invalidé / rafraîchi par la tâche `cron/pennystocks` (`runBatchPennyStocks`) ou lors d'une mise à jour manuelle des penny stocks.
  - Paramètres de requête : `limit` (optionnel, défaut: 50), `minMarketCap`/`maxMarketCap` (optionnels) — facultatif.
  - Réponse : JSON { "pennystocks": [ { "symbol": "PENNY1", "name": "Penny Co.", "marketCap": 1200000 } ], "cached": true, "cacheTs": "2026-02-07T10:00:00Z" }

- GET /suggestions
  - Description : retourne des suggestions de symboles pour l'autocomplétion.
  - Paramètres de requête : `query` (obligatoire), `type` (optionnel, défaut: `us_stocks`), `limit` (optionnel, défaut: `10`).
  - Réponse : JSON { "suggestions": [ { "symbol": "AAPL", "name": "Apple Inc.", "exchange": "NASDAQ", "type": "US_STOCK" } ] }

- PUT /symbol
  - Description : ajoute ou met à jour un symbole (les métadonnées sont enrichies automatiquement).
  - IMPORTANT : Lors d'un `PUT /symbol`, le service **doit lancer automatiquement l'analyse du symbole** et **mettre immédiatement le rapport d'analyse en cache** afin qu'il soit disponible pour les endpoints consommateurs (screener, watchlist). Le cache doit être invalidé/rafraîchi si le symbole est modifié ultérieurement.
  - Corps : { "symbolName": "AAPL" }
  - Réponse : JSON { "success": true, "symbol": { "symbol": "AAPL", "name": "Apple Inc." }, "analysisCached": true, "cachedAt": "2026-02-07T10:00:00Z" }

- GET /filter
  - Description : retourne les valeurs disponibles pour les filtres (sector, industry, exchange) et ranges numériques.
  - Réponse : JSON { "booleanFilters": {...}, "rangeFilters": {...} }

- GET /macro
  - Description : retourne l'analyse macro actuelle (régime, biais d'actifs, insights, métadonnées comme VIX).
  - IMPORTANT : cette route **doit être servie depuis le cache** (clé `macro_context`) pour éviter des appels concurrents aux sources externes et améliorer les performances. TTL recommandé : **30 minutes** (configurable via une constante). Le cache peut être rafraîchi automatiquement par la tâche planifiée (`cron/batch`) ou via un refresh manuel (script ou opération manuelle). La réponse **doit inclure** des métadonnées de cache (`cached`, `cacheTs`) pour faciliter le debug.
  - Réponse : JSON { "regime": {...}, "assetBias": {...}, "insights": [...], "metadata": {...}, "cached": true, "cacheTs": "2026-02-07T10:00:00Z" }

- cron/batch (tâche planifiée)
  - Description : exécute une analyse batch (ex : jusqu'à 20 symbols) et met à jour les résultats en base.
  - Comportement : exécution automatique toutes les 15 minutes.

- cron/pennystocks (tâche planifiée)
  - Description : scanne les penny stocks et met à jour les symboles pertinents.
  - Comportement : exécution automatique toutes les 15 minutes.

---

## 🔓 Accès & usage

- Application publique et **100% gratuite** : toutes les routes sont accessibles sans authentification.
- Pas de configuration ni de clés nécessaires côté utilisateur — l'API est conçue pour être utilisée immédiatement.
- Les résultats sont fournis au format JSON et peuvent être consommés librement par des interfaces ou scripts externes.

---

## 🧩 Déploiement (note utilisateur)

- L’application est hébergée sur Netlify et les tâches planifiées sont gérées par la plateforme.
- Aucune action technique n’est requise par l’utilisateur final : le service est prêt à l’emploi.
- Les mainteneurs de la plateforme peuvent gérer variables d’environnement ou paramètres d’exécution si nécessaire, mais cela ne concerne pas l’usage public de l’API.

---

## ⏰ Cron & planification (toutes les 15 minutes)

Deux tâches planifiées s’exécutent automatiquement toutes les 15 minutes :

- **cron/batch** : lance l’analyse en lot et met à jour les analyses et quotes des symbols.
- **cron/pennystock** : scanne les penny stocks et met à jour les symboles pertinents.

Ces tâches s’exécutent automatiquement côté plateforme; pour l’utilisateur final, elles garantissent que les analyses restent à jour (rafraîchissement toutes les 15 minutes).

---

## 🧪 Tests & validation

Recommandations de vérification (non techniques) :

- Vérifier que `GET /macro` est **servi depuis le cache** (vérifier présence d'une méta `cached` / `cacheTs`) et que son contenu est rafraîchi par la tâche planifiée (`cron/batch`) ou une opération manuelle de refresh.
- Vérifier que `GET /pennystocks` est **servi depuis le cache** (clé `pennystocks`) et que son contenu est rafraîchi par `cron/pennystock` (`runBatchPennyStocks`) ou par un refresh manuel. Vérifier champs `cached` / `cacheTs` et paramètres `limit` / filtres.
- Vérifier que `GET /watchlist` est **servi depuis le cache** (vérifier présence d'une méta `cached` / `cacheTs`) et que la route prend en charge **les filtres** et la **pagination** (vérifier `page`, `limit`, filtres booléens et ranges). S’assurer que l'invalidation fonctionne après `PUT /symbol`.
- **Vérifier que `PUT /symbol` déclenche une analyse immédiate et que le rapport d'analyse est mis en cache** (vérifier champs `analysisCached` / `cachedAt` et que l'invalidation/rafraîchissement fonctionne si le symbole est modifié).
- Vérifier que `GET /filter` renvoie les valeurs de filtre attendues et que la réponse est cohérente (ex: secteurs, industries).
- Vérifier que `GET /suggestions` renvoie des suggestions pertinentes pour une requête donnée (ex: query="apple", type="us_stocks").
- Vérifier que les tâches planifiées actualisent les analyses et que les résultats sont visibles après 15 minutes.
- S’assurer que `GET /watchlist`, `PUT /symbol`, et `GET /filter` renvoient des réponses JSON cohérentes et exploitables.

---

## 📣 CI / PR checklist (avant merge -> main)

- [ ] Lints/Format passés (ESLint + Prettier)
- [ ] Tests unitaires et fonctionnels OK
- [ ] Netlify build successful (prévisualisation branch deploy)
- [ ] Variables d'environnement configurées sur Netlify
- [ ] Endpoints cron protégés par secret

---

## 💡 Conseils d'implémentation (pratiques)

- Centraliser `fetchRealMacroData()` et exposer `GET /api/macro` pour éviter multiples appels concurrents
- **Servir `GET /macro` depuis la cache** (clé dédiée `macro_context`), TTL recommandé : **30 minutes**. Rafraîchissement assuré par la tâche planifiée (`cron/batch`) ou par un refresh manuel (script). La réponse doit inclure des méta `cached`/`cacheTs` pour faciliter l'observabilité.
- **Servir `GET /pennystocks` depuis la cache** (clé dédiée `pennystocks`), TTL recommandé : **15 minutes**. Rafraîchissement assuré par `cron/pennystock` (`runBatchPennyStocks`) ou par un refresh manuel. Inclure `cached`/`cacheTs` dans la réponse et prévoir une invalidation lors d'opérations qui modifient la liste des penny stocks.
- Utiliser la mise en cache (Server memory + DB) pour VIX et autres indicateurs macro (TTL **10–15 minutes**)
- **Servir `GET /watchlist` depuis la cache** (clé dédiée `watchlist`), et invalider le cache lorsque des symboles sont ajoutés ou mis à jour (`PUT /symbol`). TTL recommandé : **15 minutes**.
- S'assurer que les opérations de création/mise à jour de symboles (`PUT /symbol`) **déclenchent l'analyse immédiate** et **mettent en cache le rapport d'analyse** afin d'optimiser les temps de réponse pour les endpoints consommateurs.
- Loguer (logs structurés) et exposer métriques basiques (cache hits, inflight hits, cron success)

---

> Si tu veux, je peux :
>
> - générer automatiquement le `netlify.toml` et un workflow GitHub Actions (cron) dans le repo,
> - ajouter un exemple de fonction serverless pour `/api/cron/batch` (avec vérif `x-cron-token`).

---

Bonne configuration ! Dis‑moi si tu veux que je crée les fichiers (netlify.toml + `.github/workflows/cron-batch.yml`) automatiquement et ouvre une PR. ✨
