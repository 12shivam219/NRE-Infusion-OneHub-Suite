import { Router } from 'express';
import { db } from '../db';
import { errorReports } from '@shared/schema/error-reports';
import { isAuthenticated } from '../localAuth';
import { requireRole } from '../middleware/auth';
import { UserRole } from '@shared/schema';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { NotificationService } from '../services/notification';

const router = Router();

// Schema for creating error reports
const createErrorReportSchema = z.object({
  errorMessage: z.string(),
  errorStack: z.string().nullable(),
  componentStack: z.string().nullable(),
  userDescription: z.string(),
  screenshotUrls: z.array(z.string().url()).optional(),
  url: z.string(),
  userAgent: z.string(),
});

// Schema for updating error reports
const updateErrorReportSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'closed']),
  adminNotes: z.string().optional(),
});



// Create error report
router.post('/', async (req, res) => {
  try {
    const data = createErrorReportSchema.parse(req.body);
    
    const [report] = await db.insert(errorReports).values({
      ...data,
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    // Notify admins of new error report
    await NotificationService.notifyAdminsOfErrorReport(
      report.id,
      data.errorMessage,
      req.user?.email
    );

    res.status(201).json(report);
  } catch (error) {
    logger.error({ error }, 'Failed to create error report');
    res.status(500).json({ message: 'Failed to submit error report' });
  }
});

// Get all error reports (admin only)
router.get('/', isAuthenticated, requireRole(UserRole.ADMIN), async (req, res) => {
  try {
    // First test the database connection
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection is not available');
    }

    // Use queryWithTimeout to prevent hanging queries
    const reports = await queryWithTimeout(async () => {
      return await db.select().from(errorReports).orderBy(desc(errorReports.createdAt));
    });

    // Add debug logging for successful queries
    logger.debug({
      userId: req.user?.id,
      userEmail: req.user?.email,
      reportsCount: reports.length
    }, 'Successfully fetched error reports');

    res.json(reports);
  } catch (error: any) {
    // More detailed error logging
    logger.error({
      error: error?.message || error,
      stack: error?.stack,
      userId: req.user?.id,
      userEmail: req.user?.email
    }, 'Failed to fetch error reports');

    // Send more specific error messages based on the error type
    if (error?.message?.includes('connection')) {
      res.status(503).json({ 
        message: 'Database service temporarily unavailable',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to fetch error reports',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Update error report status (admin only)
router.patch('/:id', isAuthenticated, requireRole(UserRole.ADMIN), async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateErrorReportSchema.parse(req.body);

    await db.update(errorReports)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(errorReports.id, id));

    res.json({ message: 'Error report updated' });
  } catch (error) {
    logger.error({ error }, 'Failed to update error report');
    res.status(500).json({ message: 'Failed to update error report' });
  }
});

export default router;

async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Perform a simple query to check if the database is reachable
    await db.select({ id: errorReports.id }).from(errorReports).limit(1);
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection test failed');
    return false;
  }
}
async function queryWithTimeout<T>(queryFn: () => Promise<T>, timeoutMs = 10000): Promise<T> {
  return await Promise.race([
    queryFn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Database query timed out')), timeoutMs)
    ),
  ]);
}

