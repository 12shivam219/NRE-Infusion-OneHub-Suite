import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Core Web Vitals data store (in-memory, can be replaced with database)
 * In production, you may want to persist this to a database or send to an analytics service
 */
const vitalsStore: any = {
  sessions: new Map<string, any[]>(),
  aggregated: {
    lcp: [] as any[],
    fid: [] as any[],
    cls: [] as any[],
    ttfb: [] as any[],
    inp: [] as any[],
  },
  maxStoredMetrics: 10000, // Prevent unbounded growth
};

/**
 * POST /api/metrics/vitals
 * Receive a single Core Web Vitals metric
 */
router.post('/vitals', (req: Request, res: Response) => {
  try {
    const { sessionId, metric, value, rating, timestamp, url, priority } = req.body;

    if (!sessionId || !metric || typeof value !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store metric
    if (!vitalsStore.sessions.has(sessionId)) {
      vitalsStore.sessions.set(sessionId, []);
    }

    const metricData = {
      metric,
      value,
      rating,
      timestamp,
      url,
      priority,
      receivedAt: new Date().toISOString(),
    };

    vitalsStore.sessions.get(sessionId)!.push(metricData);

    // Also add to aggregated store for analytics
    const bucketName = metric.toLowerCase() as keyof typeof vitalsStore.aggregated;
    if (vitalsStore.aggregated[bucketName]) {
      vitalsStore.aggregated[bucketName].push({
        ...metricData,
        sessionId,
      });

      // Keep aggregate store bounded
      if (vitalsStore.aggregated[bucketName].length > vitalsStore.maxStoredMetrics) {
        vitalsStore.aggregated[bucketName] = vitalsStore.aggregated[bucketName].slice(-vitalsStore.maxStoredMetrics);
      }
    }

    // Log poor metrics for monitoring
    if (rating === 'poor') {
      logger.warn({
        context: {
          metric,
          value,
          sessionId,
          url,
          priority,
        },
      }, `Poor ${metric} detected: ${value}ms (${rating})`);
    }

    res.status(202).json({ received: true });
  } catch (error) {
    logger.error({ error }, 'Error processing vitals metric:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/metrics/vitals-batch
 * Receive a batch of Core Web Vitals metrics
 */
router.post('/vitals-batch', (req: Request, res: Response) => {
  try {
    const { sessionId, metrics, timestamp, url } = req.body;

    if (!sessionId || !Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({ error: 'Invalid batch payload' });
    }

    if (!vitalsStore.sessions.has(sessionId)) {
      vitalsStore.sessions.set(sessionId, []);
    }

    const sessionMetrics = vitalsStore.sessions.get(sessionId)!;

    // Process each metric in batch
    for (const m of metrics) {
      const metricData = {
        ...m,
        timestamp: m.timestamp || timestamp,
        url: m.url || url,
        batchReceivedAt: new Date().toISOString(),
      };

      sessionMetrics.push(metricData);

      // Add to aggregated store
      const bucketName = (m.name || m.metric || '').toLowerCase() as keyof typeof vitalsStore.aggregated;
      if (vitalsStore.aggregated[bucketName]) {
        vitalsStore.aggregated[bucketName].push({
          ...metricData,
          sessionId,
        });

        if (vitalsStore.aggregated[bucketName].length > vitalsStore.maxStoredMetrics) {
          vitalsStore.aggregated[bucketName] = vitalsStore.aggregated[bucketName].slice(-vitalsStore.maxStoredMetrics);
        }
      }

      // Log poor metrics
      if (m.rating === 'poor') {
        logger.warn({
          context: {
            metric: m.name || m.metric,
            value: m.value,
            sessionId,
          },
        }, `Poor ${m.name || m.metric} in batch: ${m.value}`);
      }
    }

    logger.debug({
      context: {
        sessionId,
        metricCount: metrics.length,
        url,
      },
    }, `Received ${metrics.length} metrics in batch`);

    res.status(202).json({ received: metrics.length });
  } catch (error) {
    logger.error({ error }, 'Error processing vitals batch:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/metrics/vitals-summary
 * Get aggregated metrics summary for monitoring dashboard
 */
router.get('/vitals-summary', (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const aggregateBucketStats = (bucket: any[]) => {
      const recent = bucket.filter((m: any) => {
        const time = new Date(m.batchReceivedAt || m.receivedAt).getTime();
        return time >= oneHourAgo;
      });

      if (recent.length === 0) {
        return {
          count: 0,
          avg: 0,
          min: 0,
          max: 0,
          poorCount: 0,
        };
      }

      const values = recent.map((m: any) => m.value);
      const poorCount = recent.filter((m: any) => m.rating === 'poor').length;

      return {
        count: recent.length,
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        poorCount,
      };
    };

    const summary = {
      period: { from: new Date(oneHourAgo).toISOString(), to: new Date(now).toISOString() },
      activeSessions: vitalsStore.sessions.size,
      metrics: {
        lcp: aggregateBucketStats(vitalsStore.aggregated.lcp),
        fid: aggregateBucketStats(vitalsStore.aggregated.fid),
        cls: aggregateBucketStats(vitalsStore.aggregated.cls),
        ttfb: aggregateBucketStats(vitalsStore.aggregated.ttfb),
        inp: aggregateBucketStats(vitalsStore.aggregated.inp),
      },
      totalMetricsStored: Object.values(vitalsStore.aggregated).reduce((sum, arr: any) => sum + arr.length, 0),
    };

    res.json(summary);
  } catch (error) {
    logger.error({ error }, 'Error generating vitals summary:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/metrics/vitals/:sessionId
 * Get metrics for a specific session (for debugging)
 */
router.get('/vitals/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const metrics = vitalsStore.sessions.get(sessionId) || [];

    // Apply pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
    const offset = parseInt(req.query.offset as string) || 0;

    const paginated = metrics.slice(offset, offset + limit);

    res.json({
      sessionId,
      totalCount: metrics.length,
      limit,
      offset,
      data: paginated,
    });
  } catch (error) {
    logger.error({ error }, 'Error retrieving session metrics:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/metrics/vitals/:sessionId
 * Clear metrics for a session (admin only)
 */
router.delete('/vitals/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const had = vitalsStore.sessions.has(sessionId);
    vitalsStore.sessions.delete(sessionId);

    res.json({
      sessionId,
      deleted: had,
    });
  } catch (error) {
    logger.error({ error }, 'Error deleting session metrics:');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/metrics/health
 * Health check endpoint for metrics collection
 */
router.post('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    activeSessions: vitalsStore.sessions.size,
  });
});

export { router as metricsRouter };
