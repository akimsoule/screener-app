import { prisma } from "../../../lib/prisma";
import { fetchMetadata } from "../../../lib/data/index";
import { logger, getErrorMessage } from "../../../lib/logger";
import type { SymbolType } from "../../../lib/data/provider/types";

/**
 * SERVICE SYMBOL - COUCHE MÉTIER
 * Service pour gérer l'ajout et la mise à jour des symboles
 */

export interface AddSymbolRequest {
  symbolName: string;
  symbolType: SymbolType;
  enabled?: boolean;
  isPopular?: boolean;
}

export interface AddSymbolResponse {
  success: boolean;
  symbol?: {
    id: string;
    name: string;
    symbolType: string;
    provider: string | null;
    enabled: boolean;
    metadata: any;
    createdAt: Date;
  };
  error?: string;
  alreadyExists?: boolean;
}

/**
 * Service de gestion des symboles
 */
export class SymbolService {
  /**
   * Ajoute un nouveau symbol dans la base de données
   * 1. Vérifie si le symbol existe déjà
   * 2. Récupère les métadonnées via fetchMetadata()
   * 3. Crée le symbol avec enabled=true
   */
  async addSymbol(request: AddSymbolRequest): Promise<AddSymbolResponse> {
    const {
      symbolName,
      symbolType,
      enabled = true,
      isPopular = false,
    } = request;

    try {
      logger.info(`🔍 Checking if symbol ${symbolName} exists...`);

      // 1. Vérifier si le symbol existe déjà
      const existingSymbol = await prisma.symbol.findUnique({
        where: { name: symbolName.toUpperCase() },
      });

      if (existingSymbol) {
        logger.info(`⚠️ Symbol ${symbolName} already exists`);
        return {
          success: true,
          alreadyExists: true,
          symbol: {
            id: existingSymbol.id,
            name: existingSymbol.name,
            symbolType: existingSymbol.symbolType || symbolType,
            provider: existingSymbol.provider,
            enabled: existingSymbol.enabled,
            metadata: existingSymbol.metadata,
            createdAt: existingSymbol.createdAt,
          },
        };
      }

      logger.info(`📥 Fetching metadata for ${symbolName}...`);

      // 2. Récupérer les métadonnées
      const metadata = await fetchMetadata(symbolName, symbolType);

      if (!metadata) {
        throw new Error(
          `Could not fetch metadata for ${symbolName}. Symbol may not exist or provider unavailable.`,
        );
      }

      // Déterminer le provider
      const provider = symbolType === "CRYPTO" ? "bitget" : "yahoo";

      logger.info(`💾 Creating symbol ${symbolName} in database...`);

      // 3. Créer le symbol
      const newSymbol = await prisma.symbol.create({
        data: {
          name: symbolName.toUpperCase(),
          symbolType,
          provider,
          enabled,
          isPopular,
          metadata: metadata as any,
        },
      });

      logger.info(`✅ Symbol ${symbolName} created successfully`);

      return {
        success: true,
        symbol: {
          id: newSymbol.id,
          name: newSymbol.name,
          symbolType: newSymbol.symbolType || symbolType,
          provider: newSymbol.provider,
          enabled: newSymbol.enabled,
          metadata: newSymbol.metadata,
          createdAt: newSymbol.createdAt,
        },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error(`❌ Error adding symbol ${symbolName}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Met à jour les métadonnées d'un symbol existant
   */
  async updateSymbolMetadata(symbolName: string): Promise<boolean> {
    try {
      const symbol = await prisma.symbol.findUnique({
        where: { name: symbolName.toUpperCase() },
      });

      if (!symbol?.symbolType) {
        logger.warn(`⚠️ Symbol ${symbolName} not found`);
        return false;
      }

      logger.info(`🔄 Updating metadata for ${symbolName}...`);

      const metadata = await fetchMetadata(
        symbolName,
        symbol.symbolType as SymbolType,
      );

      if (!metadata) {
        logger.warn(`⚠️ Could not fetch metadata for ${symbolName}`);
        return false;
      }

      await prisma.symbol.update({
        where: { name: symbolName.toUpperCase() },
        data: {
          metadata: metadata as any,
          updatedAt: new Date(),
        },
      });

      logger.info(`✅ Metadata updated for ${symbolName}`);
      return true;
    } catch (error) {
      logger.error(
        `❌ Error updating metadata for ${symbolName}:`,
        getErrorMessage(error),
      );
      return false;
    }
  }

  /**
   * Active ou désactive un symbol
   */
  async toggleSymbolEnabled(
    symbolName: string,
    enabled: boolean,
  ): Promise<boolean> {
    try {
      await prisma.symbol.update({
        where: { name: symbolName.toUpperCase() },
        data: { enabled },
      });

      logger.info(
        `✅ Symbol ${symbolName} ${enabled ? "enabled" : "disabled"}`,
      );
      return true;
    } catch (error) {
      logger.error(
        `❌ Error toggling symbol ${symbolName}:`,
        getErrorMessage(error),
      );
      return false;
    }
  }

  /**
   * Marque un symbol comme populaire
   */
  async toggleSymbolPopular(
    symbolName: string,
    isPopular: boolean,
  ): Promise<boolean> {
    try {
      await prisma.symbol.update({
        where: { name: symbolName.toUpperCase() },
        data: { isPopular },
      });

      logger.info(
        `✅ Symbol ${symbolName} ${isPopular ? "marked as popular" : "unmarked as popular"}`,
      );
      return true;
    } catch (error) {
      logger.error(
        `❌ Error toggling popular for ${symbolName}:`,
        getErrorMessage(error),
      );
      return false;
    }
  }

  /**
   * Supprime un symbol (soft delete via enabled=false recommandé)
   */
  async deleteSymbol(symbolName: string, hardDelete = false): Promise<boolean> {
    try {
      if (hardDelete) {
        await prisma.symbol.delete({
          where: { name: symbolName.toUpperCase() },
        });
        logger.info(`🗑️ Symbol ${symbolName} permanently deleted`);
      } else {
        await prisma.symbol.update({
          where: { name: symbolName.toUpperCase() },
          data: { enabled: false },
        });
        logger.info(`🗑️ Symbol ${symbolName} disabled (soft delete)`);
      }
      return true;
    } catch (error) {
      logger.error(
        `❌ Error deleting symbol ${symbolName}:`,
        getErrorMessage(error),
      );
      return false;
    }
  }

  /**
   * Récupère un symbol par son nom
   */
  async getSymbol(symbolName: string) {
    try {
      return await prisma.symbol.findUnique({
        where: { name: symbolName.toUpperCase() },
      });
    } catch (error) {
      logger.error(
        `❌ Error fetching symbol ${symbolName}:`,
        getErrorMessage(error),
      );
      return null;
    }
  }

  /**
   * Rafraîchit les métadonnées de tous les symbols actifs
   */
  async refreshAllMetadata(): Promise<{
    total: number;
    updated: number;
    failed: number;
  }> {
    const symbols = await prisma.symbol.findMany({
      where: { enabled: true },
      select: { name: true },
    });

    let updated = 0;
    let failed = 0;

    for (const symbol of symbols) {
      const success = await this.updateSymbolMetadata(symbol.name);
      if (success) {
        updated++;
      } else {
        failed++;
      }

      // Pause pour éviter rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.info(
      `📊 Metadata refresh complete: ${updated} updated, ${failed} failed out of ${symbols.length} total`,
    );

    return {
      total: symbols.length,
      updated,
      failed,
    };
  }
}

// Export singleton
export const symbolService = new SymbolService();
