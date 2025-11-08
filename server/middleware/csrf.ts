import { Request, Response, NextFunction } from 'express';
// import csrf from 'csurf';

// Mock CSRF protection for development
export const csrfProtection = (req: any, res: Response, next: NextFunction) => {
  // Add mock csrfToken method
  req.csrfToken = () => 'mock-csrf-token';
  next();
};

export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'EBADCSRFTOKEN') {
    res.status(403).json({ error: 'Invalid CSRF token' });
  } else {
    next(err);
  }
};

// Mock CSRF token endpoint
export const getCsrfToken = (req: any, res: Response) => {
  res.json({ csrfToken: req.csrfToken() });
};