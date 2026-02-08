// =============== IMPORTS ===============
export type { SymbolMetadata } from "../../lib/data/provider/types";

// =============== TYPES ===============

export type OHLC = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Regime = "STRONG_TREND" | "WEAK_TREND" | "RANGE" | "CHOP";
export type TradeSide = "LONG" | "SHORT" | "NONE";
export type VolatilityRegime = "HIGH" | "LOW" | "NORMAL";

// =============== INTERFACES ===============

export interface HourlyTiming {
  momentum: "BULL" | "BEAR" | "NEUTRAL";
  rsi: number;
  nearSupport: boolean;
  nearResistance: boolean;
  recommendation: string;
  optimalEntry?: number;
}

export interface RiskConfig {
  maxRiskPerTrade: number; // % du capital (ex: 0.01 = 1%)
  maxPortfolioRisk: number; // % total exposé simultanément
  maxPositions: number; // nb max de positions ouvertes
  minConfidence: number; // score min pour entrer
  maxCorrelation: number; // seuil de corrélation max entre positions
  vixThreshold: number; // VIX max autorisé
  maxDrawdown: number; // stop trading si drawdown > X%
}

export interface TradeRecommendation {
  side: TradeSide;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  sizing: null;
  rationale: string;
  holdingPeriod: {
    min: number; // jours minimum estimés
    max: number; // jours maximum estimés
    target: number; // durée cible moyenne
    description: string; // description textuelle
  };
  hourlyTiming?: HourlyTiming; // Ajouté conditionnellement pour STRONG setups
}

export interface AnalysisReport {
  symbol: string;
  timestamp: Date;
  regime: Regime;
  rawScore: number;
  score: number; // [-100, +100]
  action: "🟢 STRONG_BUY" | "🔵 BUY" | "⚪ HOLD" | "🟠 SELL" | "🔴 STRONG_SELL";
  confidence: number; // 0-100
  interpretation: string;
  riskFlags: string[]; // alertes de risque
  details: {
    price: number;
    rsi: number;
    adx: number;
    trendDaily: string;
    trendWeekly: string;
    atr: number;
    atrPercent: number;
    volatilityRegime: VolatilityRegime;
  };
  recommendation: TradeRecommendation;
  metrics: {
    winRateEstimate: number; // estimation statistique
    expectancy: number; // gain moyen pondéré
    maxAdverseExcursion: number; // pire drawdown intra-trade estimé
  };
  // Contexte macro optionnel
  macroContext?: MacroRegime;
  liotBias?: number;
}

export interface AssetClassBias {
  equities: number; // +20 = très bullish, -20 = très bearish
  bonds: number; // Obligations
  commodities: number; // Or, argent
  crypto: number; // Bitcoin/altcoins
  forex: number; // Dollar vs autres
}

export interface MacroRegime {
  phase: "RISK_ON" | "RISK_OFF" | "TRANSITION";
  cycleStage: "EARLY_CYCLE" | "MID_CYCLE" | "LATE_CYCLE" | "RECESSION";
  fedPolicy: "CUTTING" | "PAUSING" | "HAWKISH_PAUSE" | "HIKING";
  dollarRegime: "WEAK" | "NEUTRAL" | "STRENGTHENING";
  liquidity: "EXPANDING" | "NEUTRAL" | "CONTRACTING";
  confidence: number; // 0-100
}

export interface PortfolioConfig {
  maxCryptoExposure: number; // % du portefeuille max en crypto
  maxEquitiesExposure: number; // % max en actions
  lateCycleReduction: number; // Réduction en % lorsqu'en late cycle
  profitTakingThreshold: number; // Prendre des profits si asset +X% en 90j
}

export interface PortfolioRecommendation {
  targetAllocation: Record<string, number>; // { "BTC": 5, "SPY": 40, ... }
  rebalanceActions: Array<{
    asset: string;
    action: "BUY" | "SELL" | "HOLD";
    amountUSD: number;
    reason: string;
  }>;
  riskAlerts: string[];
}

export interface RiskAssessment {
  approved: boolean;
  flags: string[];
  adjustedRiskPercent: number;
}
