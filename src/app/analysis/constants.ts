/**
 * CONSTANTS & CONFIGURATION
 * Centralisation de toutes les valeurs hardcodées du système d'analyse
 */

// =============== SCORING THRESHOLDS ===============

export const SCORE_THRESHOLDS = {
  STRONG_BUY: 70,
  BUY: 40,
  SELL: -40,
  STRONG_SELL: -70,
} as const;

export const SCORE_NORMALIZATION = {
  MAX_ABS: 100,
  MAX_THEORETICAL: 120, // Score théorique maximum avec tous les indicateurs alignés
} as const;

// =============== TECHNICAL INDICATORS PERIODS ===============

export const INDICATOR_PERIODS = {
  RSI: 14,
  SMA_SHORT: 50,
  SMA_LONG: 200,
  SMA_WEEKLY: 20,
  // Hourly (pour affinage des STRONG setups)
  SMA_HOURLY: 20,
  RSI_HOURLY: 14,
  MACD_FAST: 12,
  MACD_SLOW: 26,
  MACD_SIGNAL: 9,
  ATR_SHORT: 14,
  ATR_LONG: 50,
  BOLLINGER_BANDS: 20,
  BOLLINGER_STD_DEV: 2,
  ADX: 14,
} as const;

// =============== REGIME DETECTION ===============

export const REGIME_THRESHOLDS = {
  ADX_STRONG_TREND: 30,
  ADX_WEAK_TREND: 20,
  ADX_RANGE: 15,
  SLOPE_STRONG: 0.5,
  SLOPE_WEAK: 0.2,
  ATR_PERCENT_HIGH: 5,
  ATR_PERCENT_EXTREME: 3,
  ATR_PERCENT_LOW: 1,
  ATR_MULTIPLIER_EXTREME: 1.8,
  ATR_MULTIPLIER_LOW: 0.6,
} as const;

// =============== RISK MANAGEMENT ===============

export const RISK_DEFAULTS = {
  MAX_RISK_PER_TRADE: 0.01, // 1%
  MAX_PORTFOLIO_RISK: 0.05, // 5%
  MAX_POSITIONS: 5,
  MIN_CONFIDENCE: 40,
  MAX_CORRELATION: 0.7,
  VIX_THRESHOLD: 35,
  MAX_DRAWDOWN: 0.15, // 15%
  KELLY_FRACTION: 0.25, // 25% du Kelly optimal
  MIN_KELLY: 0.01,
  MAX_KELLY: 0.05,
  MIN_VOLATILITY_ADJUSTMENT: 0.5,
  MAX_VOLATILITY_ADJUSTMENT: 1,
} as const;

// =============== TRADE RECOMMENDATION ===============

export const TRADE_PARAMS = {
  // Stop Loss ATR multipliers
  STOP_ATR_LONG: 1.8,
  STOP_ATR_SHORT: 1.5,

  // Risk-Reward ratios par qualité de setup
  RR_PREMIUM: 3, // Score >= 70
  RR_GOOD: 2, // Score >= 40
  RR_STANDARD: 1.5, // Score < 40

  // Win rate estimates
  BASE_WIN_RATE: 0.42,
  WIN_RATE_SCORE_FACTOR: 220,
  MIN_WIN_RATE: 0.45,
  MAX_WIN_RATE: 0.68,

  // Slippage/Execution factors
  AVG_WIN_PENALTY: 0.85, // 15% de pénalité pour slippage
  AVG_LOSS: 1,
  MAX_ADVERSE_EXCURSION_ATR: 2.5,
} as const;

// =============== HOLDING PERIOD ESTIMATION ===============

export const HOLDING_PERIODS = {
  // Par régime de marché
  STRONG_TREND: { min: 15 as number, max: 60 as number, target: 30 as number },
  WEAK_TREND: { min: 10 as number, max: 40 as number, target: 20 as number },
  RANGE: { min: 3 as number, max: 15 as number, target: 7 as number },
  CHOP: { min: 2 as number, max: 10 as number, target: 5 as number },

  // Ajustements par volatilité (multiplicateurs)
  HIGH_VOLATILITY_FACTOR: 0.6, // Réduire de 40% si volatile
  LOW_VOLATILITY_FACTOR: 1.3, // Augmenter de 30% si calme

  // Ajustements par qualité de setup (multiplicateurs)
  PREMIUM_SETUP_FACTOR: 1.4, // Setup premium = tenir plus longtemps
  WEAK_SETUP_FACTOR: 0.7, // Setup faible = sortir plus vite
} as const;

// =============== SCORING WEIGHTS ===============

export const SCORE_WEIGHTS = {
  // RSI (range-bound)
  RSI_OVERSOLD: 25,
  RSI_OVERSOLD_WEAK: 12,
  RSI_OVERBOUGHT: -25,
  RSI_OVERBOUGHT_WEAK: -12,

  // RSI (trending)
  RSI_TREND_CONTINUATION: 8,

  // Trend alignment
  TREND_DAILY: 20,
  TREND_WEEKLY: 25,
  TREND_ALIGNED: 15,

  // MACD
  MACD_SIGNAL: 12,
  MACD_ACCELERATION: 8,

  // Bollinger Bands
  BB_TREND_CONTINUATION: 10,
  BB_MEAN_REVERSION: 15,

  // ADX
  ADX_TREND_BOOST: 10,
  ADX_RANGE_BOOST: 8,

  // Volatility penalties
  VOLATILITY_EXTREME: -15,
  VOLATILITY_LOW: -5,
} as const;

// =============== RSI THRESHOLDS ===============

export const RSI_LEVELS = {
  OVERSOLD_STRONG: 30,
  OVERSOLD_WEAK: 40,
  NEUTRAL: 50,
  OVERBOUGHT_WEAK: 60,
  OVERBOUGHT_STRONG: 70,

  // Extreme levels
  EXTREME_OVERSOLD: 20,
  EXTREME_OVERBOUGHT: 80,
} as const;

// =============== MACRO LIOT BIAS ===============

export const LIOT_BIAS = {
  // Liquidité expansion
  LIQUIDITY_EQUITIES: 20,
  LIQUIDITY_CRYPTO: 25,
  LIQUIDITY_COMMODITIES: 15,
  LIQUIDITY_BONDS: 10,

  // Late cycle
  LATE_CYCLE_CRYPTO: -35,
  LATE_CYCLE_BONDS: 20,
  LATE_CYCLE_EQUITIES: -10,

  // Risk-on/off
  RISK_ON_EQUITIES: 15,
  RISK_ON_CRYPTO: 20,
  RISK_OFF_BONDS: 25,
  RISK_OFF_EQUITIES: -15,
  RISK_OFF_CRYPTO: -25,

  // Dollar regime
  WEAK_DOLLAR_COMMODITIES: 15,
  WEAK_DOLLAR_CRYPTO: 10,
  STRONG_DOLLAR_FOREX: 20,
  STRONG_DOLLAR_COMMODITIES: -10,
  STRONG_DOLLAR_CRYPTO: -10,

  // Saisonnalité
  OCTOBER_CRYPTO_BOOST: 10,
} as const;

// =============== ASSET CLASS PATTERNS ===============

export const ASSET_PATTERNS = {
  CRYPTO: [
    "BTC",
    "ETH",
    "SOL",
    "XRP",
    "ADA",
    "DOGE",
    "MATIC",
    "BNB",
    "AVAX",
    "DOT",
    "LINK",
    "UNI",
    "ATOM",
    "LTC",
    "BCH",
    "SHIB",
    "TRX",
    "LEO",
    "DAI",
    "WBTC",
    "TON",
    "ARB",
    "OP",
  ],

  BONDS_ETF: [
    "TLT",
    "IEF",
    "AGG",
    "BND",
    "HYG",
    "LQD",
    "MUB",
    "GOVT",
    "SHY",
    "TIP",
    "VCIT",
    "VCSH",
    "BSV",
    "BIV",
    "BLV",
  ],

  COMMODITIES_ETF: [
    "GLD",
    "SLV",
    "USO",
    "UNG",
    "DBA",
    "DBC",
    "PDBC",
    "IAU",
    "GDX",
    "GDXJ",
    "XLE",
    "XOP",
    "COPX",
    "PALL",
  ],

  FOREX: [
    "DXY",
    "EURUSD",
    "GBPUSD",
    "USDJPY",
    "USDCHF",
    "AUDUSD",
    "USDCAD",
    "NZDUSD",
    "EURGBP",
    "EURJPY",
  ],
} as const;

// =============== SECTOR KEYWORDS ===============

export const SECTOR_KEYWORDS = {
  BASIC_MATERIALS: ["BASIC MATERIALS", "MATERIALS"],
  PRECIOUS_METALS: ["GOLD", "SILVER", "PRECIOUS METAL", "MINING"],
  BONDS: ["BOND", "FIXED INCOME", "TREASURY"],
  COMMODITIES: ["COMMODIT", "COMMODITY"],
} as const;

// =============== DATA REQUIREMENTS ===============

export const DATA_REQUIREMENTS = {
  MIN_DAILY_CANDLES: 250,
  MIN_WEEKLY_CANDLES: 40,
  MIN_HOURLY_CANDLES: 100, // ~4 jours de données hourly (pour affinage)
  MIN_DATA_POINTS_RSI: 14,
  MIN_DATA_POINTS_SMA200: 200,

  // Requirements réduits pour cryptos (moins d'historique disponible)
  CRYPTO_MIN_DAILY_CANDLES: 100,
  CRYPTO_MIN_WEEKLY_CANDLES: 20,
  CRYPTO_MIN_HOURLY_CANDLES: 168, // ~7 jours (24h x 7)
} as const;

// =============== TYPE GUARDS ===============

export function isValidScore(score: number): boolean {
  return score >= -100 && score <= 100;
}

export function isStrongSignal(score: number): boolean {
  return Math.abs(score) >= SCORE_THRESHOLDS.STRONG_BUY;
}

export function isTradeable(
  score: number,
  minConfidence: number = RISK_DEFAULTS.MIN_CONFIDENCE,
): boolean {
  return Math.abs(score) >= minConfidence;
}
