import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000, // 30s pour les tests API
    hookTimeout: 30000,
    // Exécuter les tests séquentiellement pour éviter le rate limiting
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Un seul fork pour éviter les appels API parallèles
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "test/",
        "**/*.config.ts",
        "**/*.d.ts",
      ],
    },
  },
});
