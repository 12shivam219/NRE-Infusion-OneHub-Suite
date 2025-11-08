import { Application } from 'express';
import { securityHeaders, corsOptions, createRateLimit, sanitizeInput } from '../middleware/security';
import { csrfProtection, csrfErrorHandler } from '../middleware/csrf';
import cors from 'cors';
import compression from 'compression';
import { secureLogger } from '../utils/secure-logger';

export const configureProductionSecurity = (app: Application) => {
  // Trust proxy for accurate IP addresses
  app.set('trust proxy', 1);
  
  // Compression
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req: any, res: any) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  
  // Security headers
  app.use(securityHeaders);
  
  // CORS
  app.use(cors(corsOptions));
  
  // Rate limiting
  app.use('/api/', createRateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes
  app.use('/auth/', createRateLimit(15 * 60 * 1000, 20)); // 20 auth requests per 15 minutes
  app.use('/admin/', createRateLimit(15 * 60 * 1000, 50)); // 50 admin requests per 15 minutes
  
  // Input sanitization
  app.use(sanitizeInput);
  
  // CSRF protection for state-changing operations
  app.use('/api/', csrfProtection);
  app.use('/admin/', csrfProtection);
  
  // CSRF error handling
  app.use(csrfErrorHandler);
  
  // Security logging middleware
  app.use((req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      // Log suspicious patterns
      if (duration > 10000) { // Slow requests
        secureLogger.warn('Slow request detected', {
          method: req.method,
          url: req.url,
          duration,
          ip: req.ip
        });
      }
      
      if (res.statusCode >= 400) {
        secureLogger.warn('HTTP error response', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          ip: req.ip
        });
      }
    });
    
    next();
  });
  
  // Disable powered by header
  app.disable('x-powered-by');
  
  // Prevent parameter pollution
  app.use((req, res, next) => {
    for (const key in req.query) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = (req.query[key] as string[])[0];
      }
    }
    next();
  });
  
  secureLogger.info('Production security configuration applied');
};

export default configureProductionSecurity;