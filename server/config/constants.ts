/**
 * Application Constants
 * Centralized configuration for all magic numbers and constants
 */

// Server Configuration
export const SERVER_CONFIG = {
  DEFAULT_PORT: 5000,
  VITE_PORT: 5173,
  SERVER_TIMEOUT_MS: 120000, // 2 minutes for file uploads
  KEEP_ALIVE_TIMEOUT_MS: 61000,
  HEADERS_TIMEOUT_MS: 65000,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 30000, // 30 seconds
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  STATIC_ASSETS_MAX_AGE_SECONDS: 31536000, // 1 year
  HTML_MAX_AGE_SECONDS: 3600, // 1 hour
  USER_CACHE_TTL_MS: 5000, // 5 seconds
} as const;

// Session Configuration
export const SESSION_CONFIG = {
  MAX_AGE_MS: 3600000, // 1 hour
  CLEANUP_INTERVAL_MS: 86400000, // 24 hours
  MEMORY_STORE_MAX_SESSIONS: 1000,
} as const;

// Authentication Configuration
export const AUTH_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_DURATION_MS: 900000, // 15 minutes
  CLEANUP_INTERVAL_MS: 3600000, // 1 hour
  MAX_LOGIN_ATTEMPTS_STORE_SIZE: 1000,
  BCRYPT_SALT_ROUNDS: 12,
  PASSWORD_MIN_LENGTH: 8,
} as const;

// File Upload Configuration
export const FILE_CONFIG = {
  DEFAULT_MAX_FILE_SIZE_BYTES: 25000000, // 25MB
  LARGE_FILE_SIZE_BYTES: 50000000, // 50MB
  MAX_SYNC_DOCX_SIZE_BYTES: 7000000, // 7MB
  MAX_FILES_PER_REQUEST: 3,
  DEFAULT_MAX_BODY_SIZE: '1mb',
} as const;

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  DEFAULT_WINDOW_MS: 60000, // 1 minute
  DEFAULT_MAX_REQUESTS: 100,
  UPLOAD_MAX_REQUESTS: 10,
  LOGIN_MAX_ATTEMPTS: 10,
  LOGIN_WINDOW_MS: 900000, // 15 minutes
  VERIFICATION_MAX_ATTEMPTS: 3,
  VERIFICATION_WINDOW_MS: 300000, // 5 minutes
} as const;

// Database Configuration
export const DB_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  CONNECTION_TIMEOUT_MS: 30000,
} as const;

// Job Processing Configuration
export const JOB_CONFIG = {
  DEFAULT_PRIORITY: 1,
  HIGH_PRIORITY: 0,
  LOW_PRIORITY: 2,
  MAX_ATTEMPTS: 3,
  CLEANUP_OLDER_THAN_DAYS: 7,
} as const;

// Redis Configuration
export const REDIS_CONFIG = {
  DEFAULT_TTL_SECONDS: 300, // 5 minutes
  SESSION_TTL_SECONDS: 3600, // 1 hour
  CACHE_TTL_SECONDS: 86400, // 24 hours
  MAX_RETRIES: 3,
} as const;

// Email Configuration
export const EMAIL_CONFIG = {
  VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_HOURS: 1,
  MAX_SEND_ATTEMPTS: 3,
} as const;

// Validation Configuration
export const VALIDATION_CONFIG = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_EMAIL_LENGTH: 254,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 5000,
} as const;

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  BATCH_SIZE: 100,
  MAX_CONCURRENT_OPERATIONS: 10,
  MEMORY_USAGE_THRESHOLD_MB: 512,
} as const;

// Security Configuration
export const SECURITY_CONFIG = {
  CSRF_TOKEN_LENGTH_BYTES: 24,
  ENCRYPTION_KEY_LENGTH: 32,
  JWT_EXPIRY_HOURS: 24,
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
} as const;