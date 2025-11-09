import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { logger } from '../utils/logger';
import path from 'path'; // FIX: Imported path for path normalization

// Rate limiting configuration
export const createRateLimit = (windowMs: number = 15 * 60 * 1000, max: number = 100) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({ error: 'Too many requests, please try again later' });
    }
  });
};

// Security headers
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // FIX: Removed 'unsafe-inline' from styleSrc to strengthen CSP (Medium Fix)
      styleSrc: ["'self'", "https://fonts.googleapis.com"], 
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Input validation middleware (Mocked, should be replaced with a real validator like express-validator)
export const validateInput = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Mock validation for development
    next();
  };
};

// Common validation rules
export const commonValidations = {
  email: (req: Request) => req,
  password: (req: Request) => req,
  id: (req: Request) => req,
  filename: (req: Request) => req,
  page: (req: Request) => req,
  limit: (req: Request) => req
};

// Sanitize user input (FIX: Simplified sanitization as regex is not a sufficient defense for all XSS)
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // WARNING: This provides only a basic, last-line-of-defense filter for XSS 
  // on simple string values. Primary defense should be proper encoding on output 
  // (e.g., in React/JSX) and using context-aware sanitizers (e.g., DOMPurify) 
  // before rendering user-generated HTML.

  const sanitizeString = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    return obj;
  };
  
  // Apply only to top-level object properties that are strings
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    for (const key in req.body) { req.body[key] = sanitizeString(req.body[key]); }
  }
  if (req.query && typeof req.query === 'object' && !Array.isArray(req.query)) {
    for (const key in req.query) { req.query[key] = sanitizeString(req.query[key]); }
  }
  if (req.params && typeof req.params === 'object' && !Array.isArray(req.params)) {
    for (const key in req.params) { req.params[key] = sanitizeString(req.params[key]); }
  }

  next();
};

// Path traversal protection (FIX: Added path.normalize and null byte check for robustness)
export const validatePath = (pathString: string): boolean => {
  if (!pathString || typeof pathString !== 'string') return false;

  // Use path.normalize to resolve sequences like 'foo/../bar' to 'bar'
  const normalizedPath = path.normalize(pathString).replace(/\\/g, '/');

  // Check for directory traversal sequences, absolute paths, and null bytes
  if (
    normalizedPath.includes('../') || 
    normalizedPath.includes('./') || // Check for explicit relative to prevent simple bypass
    normalizedPath.startsWith('/') ||
    normalizedPath.includes('\0') || // Check for null byte attacks
    /[<>:"|?*]/.test(normalizedPath)
  ) {
    return false;
  }
  
  return true;
};

// SQL injection protection
export const preventSQLInjection = (input: string): string => {
  // WARNING: This is a weak, last-line-of-defense filter. 
  // All database interactions MUST use **parameterized queries** (e.g., Drizzle, Knex) 
  // to prevent SQL Injection, regardless of this filter.
  return input.replace(/['";\\]/g, '');
};

// Command injection protection
export const sanitizeCommand = (input: string): string => {
  // WARNING: User input should NOT be concatenated directly into an OS command string. 
  // Use array arguments for APIs like 'child_process.spawn' or 'execFile' to safely pass arguments.
  // This function is retained only as a brittle, defensive measure.
  return input.replace(/[;&|`$(){}[\]<>\n]/g, '');
};

export default {
  createRateLimit,
  securityHeaders,
  corsOptions,
  validateInput,
  commonValidations,
  sanitizeInput,
  validatePath,
  preventSQLInjection,
  sanitizeCommand
};