/**
 * Cache system with memory and database providers
 * - Memory cache: Fast, volatile, limited TTL
 * - Database cache: Persistent, longer TTL, shared across instances
 */

import { getErrorMessage, logger } from "./logger.js";
import { prisma } from "./prisma.js";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

type CacheCategory =
  | "suggestions"
  | "metadata"
  | "ohlc"
  | "quote"
  | "watchlist"
  | "screener"
  | "symbols"
  | "macro";

class CacheSystem {
  private readonly memoryCache = new Map<string, CacheEntry<any>>();

  /**
   * Set cache in memory
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get cache from memory
   */
  get<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache in database (persistent)
   */
  async setDb<T>(
    key: string,
    data: T,
    category: CacheCategory,
    ttlSeconds: number,
    provider?: string,
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);

      await prisma.cache.upsert({
        where: { key },
        create: {
          key,
          value: data as any,
          category,
          provider,
          expiresAt,
        },
        update: {
          value: data as any,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(
        `❌ Error saving to DB cache (${key}):`,
        getErrorMessage(error),
      );
    }
  }

  /**
   * Get cache from database
   */
  async getDb<T>(key: string): Promise<T | null> {
    try {
      const cached = await prisma.cache.findFirst({
        where: {
          key,
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
      });

      if (!cached) return null;

      return cached.value as unknown as T;
    } catch (error) {
      logger.error(
        `❌ Error reading from DB cache (${key}):`,
        getErrorMessage(error),
      );
      return null;
    }
  }

  /**
   * Get cache with fallback: memory → database → null
   */
  async getWithFallback<T>(key: string): Promise<T | null> {
    // 1. Try memory cache first
    const memResult = this.get<T>(key);
    if (memResult) return memResult;

    // 2. Try database cache
    const dbResult = await this.getDb<T>(key);
    if (dbResult) {
      // Store in memory for next time
      this.set(key, dbResult, 300); // 5 min TTL in memory
      return dbResult;
    }

    return null;
  }

  /**
   * Delete cache entry (both memory and database)
   */
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await prisma.cache.delete({ where: { key } });
    } catch (error) {
      logger.error(
        `❌ Error deleting from DB cache (${key}):`,
        getErrorMessage(error),
      );
    }
  }

  /**
   * Delete cache entries matching a prefix (memory + DB)
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    // Memory cache
    for (const key of Array.from(this.memoryCache.keys())) {
      if (key.startsWith(prefix)) this.memoryCache.delete(key);
    }

    // DB cache
    try {
      await prisma.cache.deleteMany({ where: { key: { startsWith: prefix } } });
    } catch (error) {
      logger.error(
        `❌ Error deleting DB cache by prefix (${prefix}):`,
        getErrorMessage(error),
      );
    }
  }

  /**
   * Clear memory cache
   */
  clear(): void {
    this.memoryCache.clear();
  }

  /**
   * Cleanup expired entries from memory
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Cleanup expired entries from database
   */
  async cleanupDb(): Promise<void> {
    try {
      const deleted = await prisma.cache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(), // Expired
          },
        },
      });
      if (deleted.count > 0) {
        logger.info(`🧹 Cleaned up ${deleted.count} expired DB cache entries`);
      }
    } catch (error) {
      logger.error("❌ Error cleaning up DB cache:", getErrorMessage(error));
    }
  }
}

export const cache = new CacheSystem();

// Cleanup memory every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

// Cleanup database every hour
setInterval(() => cache.cleanupDb(), 60 * 60 * 1000);
