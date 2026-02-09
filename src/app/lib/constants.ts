// Centralized shared constants for client and server
// Pagination: different defaults for front and backend

export const SERVER_PAGE_LIMIT = 20;
export const MUST_BE_AUTHENTICATED = false;

// Cache TTLs (seconds)
export const ANALYSIS_CACHE_TTL = 15 * 60; // 15 minutes - analysis reports
export const MACRO_CACHE_TTL = 30 * 60; // 30 minutes - macro analysis
