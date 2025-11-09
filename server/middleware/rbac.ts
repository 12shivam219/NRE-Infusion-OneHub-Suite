import { Request, Response, NextFunction } from 'express';
import { UserRoleType, PermissionType, UserRole } from '@shared/schema';
import { hasPermission, hasRoleLevel, hasAllPermissions } from '../utils/permissions';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

/**
 * FIX: Replaced the inefficient getUserRole with a dynamic resolver.
 * This function checks if the role is already cached on req.user (solving N+1).
 * If not found, it fetches it once from the DB and caches it back onto req.user.
 */
async function resolveUserRole(req: Request): Promise<UserRoleType> {
  // 1. Check if the role is already cached on the request's user object
  if (req.user?.role) {
    return req.user.role as UserRoleType;
  }
  
  // 2. If not cached, fetch it from the database
  const user = await db.query.users.findFirst({
    where: eq(users.id, req.user!.id),
    columns: {
      role: true
    }
  });
  
  const userRole = user?.role || UserRole.USER;
  
  // 3. Cache the fetched role onto the request object for subsequent middleware checks
  if (req.user) {
    req.user.role = userRole;
  }
  
  return userRole;
}

/**
 * Middleware to require a specific role
 */
export const requireRole = (role: UserRoleType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      // FIX: Use the efficient resolver instead of repeated DB query
      const userRole = await resolveUserRole(req);
      
      if (!hasRoleLevel(userRole, role)) {
        logger.warn({ userId: req.user.id, requiredRole: role, userRole }, 'Insufficient role');
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE'
        });
      }
      
      // Note: resolveUserRole already attached the role to req.user
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Role check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'ROLE_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware to require specific permission
 */
export const requirePermission = (permission: PermissionType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      // FIX: Use the efficient resolver instead of repeated DB query
      const userRole = await resolveUserRole(req);
      
      if (!hasPermission(userRole, permission)) {
        logger.warn({ userId: req.user.id, requiredPermission: permission, userRole }, 'Permission denied');
        return res.status(403).json({ 
          message: 'Permission denied',
          code: 'PERMISSION_DENIED'
        });
      }
      
      // Note: resolveUserRole already attached the role to req.user
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Permission check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware to require multiple permissions (all must be present)
 */
export const requireAllPermissions = (permissions: PermissionType[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    try {
      // FIX: Use the efficient resolver instead of repeated DB query
      const userRole = await resolveUserRole(req);
      
      if (!hasAllPermissions(userRole, permissions)) {
        logger.warn({ userId: req.user.id, requiredPermissions: permissions, userRole }, 'Insufficient permissions');
        return res.status(403).json({ 
          message: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      // Note: resolveUserRole already attached the role to req.user
      next();
    } catch (error) {
      logger.error({ error, userId: req.user.id }, 'Permission check failed');
      res.status(500).json({ 
        message: 'Internal server error',
        code: 'PERMISSION_CHECK_FAILED'
      });
    }
  };
};