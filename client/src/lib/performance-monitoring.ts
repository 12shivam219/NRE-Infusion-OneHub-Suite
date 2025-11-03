/**
 * Core Web Vitals Monitoring
 * Tracks Largest Contentful Paint (LCP), First Input Delay (FID), and Cumulative Layout Shift (CLS)
 * for production performance analytics
 */

interface VitalsMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  id: string;
  delta?: number;
  previousValue?: number;
}

interface PerformanceThresholds {
  LCP: { good: number; poor: number };
  FID: { good: number; poor: number };
  CLS: { good: number; poor: number };
  TTFB: { good: number; poor: number };
  INP: { good: number; poor: number };
}

// Web Vitals thresholds (https://web.dev/vitals/)
const VITALS_THRESHOLDS: PerformanceThresholds = {
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
  FID: { good: 100, poor: 300 },        // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
  TTFB: { good: 600, poor: 1800 },      // Time to First Byte
  INP: { good: 200, poor: 500 },        // Interaction to Next Paint
};

class CoreWebVitalsMonitor {
  private vitals: Map<string, VitalsMetric> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private sessionId: string;
  private metricsBuffer: VitalsMetric[] = [];
  private bufferFlushInterval = 30000; // 30 seconds
  private bufferFlushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
  }

  /**
   * Initialize all Web Vitals monitoring
   */
  private initializeMonitoring(): void {
    if (typeof window === 'undefined' || !('performance' in window)) {
      console.warn('[Vitals] Performance API not available');
      return;
    }

    // Only monitor in production
    if (import.meta.env.PROD) {
      this.monitorLCP();
      this.monitorFID();
      this.monitorCLS();
      this.monitorTTFB();
      this.monitorINP();
      this.setupPeriodicFlush();
    }
  }

  /**
   * Monitor Largest Contentful Paint (LCP)
   * Measures when the largest element is painted to the screen
   */
  private monitorLCP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;

        const value = lastEntry.renderTime || lastEntry.loadTime || 0;
        const metric: VitalsMetric = {
          name: 'LCP',
          value: Math.round(value),
          rating: this.getRating('LCP', value),
          id: `${this.sessionId}-lcp-${Date.now()}`,
        };

        this.recordMetric(metric);

        // Report immediately if poor performance
        if (metric.rating === 'poor') {
          this.reportMetric(metric, { priority: 'high' });
        }
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.set('LCP', observer);
    } catch (error) {
      console.warn('[Vitals] LCP monitoring failed:', error);
    }
  }

  /**
   * Monitor First Input Delay (FID) / Interaction to Next Paint (INP)
   * Measures responsiveness to user input
   */
  private monitorFID(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        for (const entry of entries) {
          const processingDuration = (entry as any).processingDuration || 0;
          const metric: VitalsMetric = {
            name: 'FID',
            value: Math.round(processingDuration),
            rating: this.getRating('FID', processingDuration),
            id: `${this.sessionId}-fid-${entry.startTime}`,
          };

          this.recordMetric(metric);

          // Report poor interactions
          if (metric.rating === 'poor') {
            this.reportMetric(metric, { priority: 'high' });
          }
        }
      });

      observer.observe({ type: 'first-input', buffered: true });
      this.observers.set('FID', observer);
    } catch (error) {
      console.warn('[Vitals] FID monitoring failed:', error);
    }
  }

  /**
   * Monitor Cumulative Layout Shift (CLS)
   * Measures visual stability and layout shifts
   */
  private monitorCLS(): void {
    try {
      let clsValue = 0;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count layout shifts without user input
          const hadRecentInput = (entry as any).hadRecentInput || false;
          if (!hadRecentInput) {
            clsValue += (entry as any).value;

            const metric: VitalsMetric = {
              name: 'CLS',
              value: Math.round(clsValue * 1000) / 1000,
              rating: this.getRating('CLS', clsValue),
              id: `${this.sessionId}-cls-${Date.now()}`,
              previousValue: clsValue,
            };

            this.recordMetric(metric);

            // Report poor CLS periodically
            if (metric.rating === 'poor' && Math.random() < 0.1) {
              this.reportMetric(metric, { priority: 'medium' });
            }
          }
        }
      });

      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.set('CLS', observer);
    } catch (error) {
      console.warn('[Vitals] CLS monitoring failed:', error);
    }
  }

  /**
   * Monitor Time to First Byte (TTFB)
   * Measures backend and network latency
   */
  private monitorTTFB(): void {
    try {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navTiming) {
        const ttfb = navTiming.responseStart - navTiming.fetchStart;

        const metric: VitalsMetric = {
          name: 'TTFB',
          value: Math.round(ttfb),
          rating: this.getRating('TTFB', ttfb),
          id: `${this.sessionId}-ttfb-${navTiming.fetchStart}`,
        };

        this.recordMetric(metric);

        if (metric.rating === 'poor') {
          this.reportMetric(metric, { priority: 'high', context: 'backend-latency' });
        }
      }
    } catch (error) {
      console.warn('[Vitals] TTFB monitoring failed:', error);
    }
  }

  /**
   * Monitor Interaction to Next Paint (INP)
   * Newer metric that replaces FID, measures full interaction latency
   */
  private monitorINP(): void {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();

        for (const entry of entries) {
          const inpValue = (entry as any).duration;

          const metric: VitalsMetric = {
            name: 'INP',
            value: Math.round(inpValue),
            rating: this.getRating('INP', inpValue),
            id: `${this.sessionId}-inp-${entry.startTime}`,
          };

          this.recordMetric(metric);

          // Report poor INP
          if (metric.rating === 'poor') {
            this.reportMetric(metric, { priority: 'high' });
          }
        }
      });

      (observer as any).observe({ type: 'event', buffered: true, durationThreshold: 40 });
      this.observers.set('INP', observer);
    } catch (error) {
      console.warn('[Vitals] INP monitoring failed:', error);
    }
  }

  /**
   * Get performance rating based on thresholds
   */
  private getRating(metric: keyof PerformanceThresholds, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = VITALS_THRESHOLDS[metric];
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Record metric locally
   */
  private recordMetric(metric: VitalsMetric): void {
    this.vitals.set(metric.id, metric);
    this.metricsBuffer.push(metric);

    // Log locally in dev mode
    if (import.meta.env.DEV) {
      console.log(`[Vitals] ${metric.name}: ${metric.value}ms (${metric.rating})`);
    }
  }

  /**
   * Report metric to analytics backend
   */
  private reportMetric(metric: VitalsMetric, options: { priority?: string; context?: string } = {}): void {
    try {
      const payload = {
        sessionId: this.sessionId,
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...options,
      };

      // Use sendBeacon for reliability (won't block page unload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/vitals', JSON.stringify(payload));
      } else {
        // Fallback to fetch with keepalive
        fetch('/api/metrics/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Silent fail - analytics errors shouldn't break the app
        });
      }
    } catch (error) {
      console.warn('[Vitals] Failed to report metric:', error);
    }
  }

  /**
   * Setup periodic buffer flush
   */
  private setupPeriodicFlush(): void {
    this.bufferFlushTimer = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);
  }

  /**
   * Flush accumulated metrics to backend
   */
  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    const batch = this.metricsBuffer.splice(0, this.metricsBuffer.length);

    try {
      const payload = {
        sessionId: this.sessionId,
        metrics: batch,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/metrics/vitals-batch', JSON.stringify(payload));
      } else {
        fetch('/api/metrics/vitals-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Return metrics to buffer on failure
          this.metricsBuffer.unshift(...batch);
        });
      }
    } catch (error) {
      console.warn('[Vitals] Buffer flush failed:', error);
      this.metricsBuffer.unshift(...batch);
    }
  }

  /**
   * Get all recorded metrics
   */
  public getMetrics(): Record<string, VitalsMetric> {
    const result: Record<string, VitalsMetric> = {};
    this.vitals.forEach((metric) => {
      result[metric.id] = metric;
    });
    return result;
  }

  /**
   * Get latest metric for a specific vital
   */
  public getLatestMetric(name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP'): VitalsMetric | undefined {
    let latest: VitalsMetric | undefined;
    this.vitals.forEach((metric) => {
      if (metric.name === name && (!latest || metric.value > latest.value)) {
        latest = metric;
      }
    });
    return latest;
  }

  /**
   * Get performance summary
   */
  public getSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      sessionId: this.sessionId,
      metrics: {},
    };

    (['LCP', 'FID', 'CLS', 'TTFB', 'INP'] as const).forEach((name) => {
      const latest = this.getLatestMetric(name);
      if (latest) {
        summary.metrics[name] = {
          value: latest.value,
          rating: latest.rating,
          threshold: VITALS_THRESHOLDS[name],
        };
      }
    });

    return summary;
  }

  /**
   * Cleanup and disconnect observers
   */
  public cleanup(): void {
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers.clear();

    if (this.bufferFlushTimer) {
      clearInterval(this.bufferFlushTimer);
    }

    // Final flush before cleanup
    this.flushMetricsBuffer();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
let monitorInstance: CoreWebVitalsMonitor | null = null;

/**
 * Initialize Core Web Vitals monitoring
 * Safe to call multiple times - only initializes once
 */
export function initializeVitalsMonitoring(): CoreWebVitalsMonitor {
  if (!monitorInstance) {
    monitorInstance = new CoreWebVitalsMonitor();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (monitorInstance) {
        monitorInstance.cleanup();
      }
    });
  }
  return monitorInstance;
}

/**
 * Get the vitals monitor instance
 */
export function getVitalsMonitor(): CoreWebVitalsMonitor | null {
  return monitorInstance;
}

/**
 * Get current performance summary
 */
export function getPerformanceSummary(): Record<string, any> {
  if (!monitorInstance) {
    return {};
  }
  return monitorInstance.getSummary();
}

export type { VitalsMetric, PerformanceThresholds };
