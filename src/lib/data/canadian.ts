/**
 * GENERATED FILE — DO NOT EDIT
 * This file is produced by `scripts/extract-canadian.ts`.
 * Source: ./alpha.json
 */

export type AssetType = 'Stock' | 'ETF' | string;

export interface AlphaRecord {
  name: string;
  symbol: string;
  exchange: string;
  assetType: AssetType;
}

export const canadian: AlphaRecord[] = [
  {
    "name": "JPMORGAN BETABUILDERS CANADA ETF ",
    "symbol": "BBCA",
    "exchange": "BATS",
    "assetType": "ETF"
  },
  {
    "name": "Brookfield BRP Holdings (Canada) Inc",
    "symbol": "BEPH",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Brookfield BRP Holdings (Canada) Inc",
    "symbol": "BEPI",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Brookfield BRP Holdings (Canada) Inc",
    "symbol": "BEPJ",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Canadian Imperial Bank Of Commerce",
    "symbol": "CM",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Canadian National Railway Company",
    "symbol": "CNI",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Canadian Natural Resources Ltd",
    "symbol": "CNQ",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Canadian Pacific Kansas City Ltd",
    "symbol": "CP",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "Canadian Solar Inc",
    "symbol": "CSIQ",
    "exchange": "NASDAQ",
    "assetType": "Stock"
  },
  {
    "name": "iShares MSCI Canada ETF",
    "symbol": "EWC",
    "exchange": "NYSE ARCA",
    "assetType": "ETF"
  },
  {
    "name": "FRANKLIN FTSE CANADA ETF ",
    "symbol": "FLCA",
    "exchange": "NYSE ARCA",
    "assetType": "ETF"
  },
  {
    "name": "Invesco CurrencyShares Canadian Dollar Trust",
    "symbol": "FXC",
    "exchange": "NYSE ARCA",
    "assetType": "ETF"
  },
  {
    "name": "Canada Goose Holdings Inc (Subord Vot Shs)",
    "symbol": "GOOS",
    "exchange": "NYSE",
    "assetType": "Stock"
  },
  {
    "name": "iShares Currency Hedged MSCI Canada ETF",
    "symbol": "HEWC",
    "exchange": "NYSE ARCA",
    "assetType": "ETF"
  },
  {
    "name": "PyroGenesis Canada Inc",
    "symbol": "PYR",
    "exchange": "NASDAQ",
    "assetType": "Stock"
  },
  {
    "name": "Royal Bank Of Canada",
    "symbol": "RY",
    "exchange": "NYSE",
    "assetType": "Stock"
  }
] as AlphaRecord[];

export default canadian;
