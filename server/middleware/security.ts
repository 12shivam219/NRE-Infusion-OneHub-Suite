import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
// import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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

// Input validation middleware
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

// Sanitize user input
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  
  next();
};

// Path traversal protection
export const validatePath = (path: string): boolean => {
  const normalizedPath = path.replace(/\\/g, '/');
  return !normalizedPath.includes('../') && 
         !normalizedPath.includes('./') && 
         !normalizedPath.startsWith('/') &&
         !/[<>:"|?*]/.test(normalizedPath);
};

// SQL injection protection
export const preventSQLInjection = (input: string): string => {
  return input.replace(/['";\\]/g, '');
};

// Command injection protection
export const sanitizeCommand = (input: string): string => {
  return input.replace(/[;&|`$(){}[\]<>]/g, '');
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