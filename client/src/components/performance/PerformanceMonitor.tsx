import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface LayoutShiftEntry extends PerformanceEntry {
  hadRecentInput: boolean;
  value: number;
}

const measureCLS = (onReport: (value: number) => void) => {
  let sessionValue = 0;
  let sessionEntries: LayoutShiftEntry[] = [];

  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries() as LayoutShiftEntry[]) {
      if (!entry.hadRecentInput) {
        const firstSessionEntry = sessionEntries[0];
        const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

        if (
          sessionValue &&
          entry.startTime - lastSessionEntry?.startTime < 1000 &&
          entry.startTime - firstSessionEntry?.startTime < 5000
        ) {
          sessionValue += entry.value;
        } else {
          sessionValue = entry.value;
          sessionEntries = [entry];
        }

        if (entry.value > 0) {
          onReport(sessionValue);
        }
      }
    }
  });

  observer.observe({ entryTypes: ['layout-shift'] });
  return () => observer.disconnect();
};

interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
  size: number;
  id: string;
  url: string;
  element: Element | null;
}

interface FirstInputDelayEntry extends PerformanceEntry {
  processingStart: number;
  processingEnd: number;
  duration: number;
  target: Element | null;
}

const measureLCP = (onReport: (value: number) => void) => {
  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries() as LargestContentfulPaintEntry[];
    const lastEntry = entries[entries.length - 1];
    onReport(lastEntry.startTime);
  });

  observer.observe({ entryTypes: ['largest-contentful-paint'] });
  return () => observer.disconnect();
};

const measureFID = (onReport: (value: number) => void) => {
  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries() as FirstInputDelayEntry[];
    entries.forEach((entry) => {
      onReport(entry.processingStart - entry.startTime);
    });
  });

  observer.observe({ entryTypes: ['first-input'] });
  return () => observer.disconnect();
};

export const PerformanceMonitor: React.FC = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Mark route change (using non-reserved name)
    try {
      performance.mark(`route-change-${location}-${Date.now()}`);
    } catch (e) {
      // Silently ignore if mark fails
    }

    // Measure Core Web Vitals
    const disconnectCLS = measureCLS((value) => {
      if (value > 0.1) {
        console.warn(`High Cumulative Layout Shift detected: ${value.toFixed(3)}`);
      }
    });

    const disconnectLCP = measureLCP((value) => {
      if (value > 2500) {
        console.warn(`Slow Largest Contentful Paint: ${value.toFixed(0)}ms`);
      }
    });

    const disconnectFID = measureFID((value) => {
      if (value > 100) {
        console.warn(`High First Input Delay: ${value.toFixed(0)}ms`);
      }
    });

    // Measure route change performance
    const routeChangeComplete = () => {
      performance.mark('routeChangeComplete');
      performance.measure('routeChange', 'navigationStart', 'routeChangeComplete');

      const navigationTiming = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;
      if (navigationTiming) {
        const timeToFirstByte = navigationTiming.responseStart - navigationTiming.requestStart;
        const domInteractive = navigationTiming.domInteractive - navigationTiming.requestStart;
        const loadComplete = navigationTiming.loadEventEnd - navigationTiming.requestStart;

        if (timeToFirstByte > 600) {
          console.warn(`Slow Time to First Byte: ${timeToFirstByte.toFixed(0)}ms`);
        }

        if (domInteractive > 1000) {
          console.warn(`Slow DOM Interactive: ${domInteractive.toFixed(0)}ms`);
        }

        if (loadComplete > 3000) {
          console.warn(`Slow Page Load: ${loadComplete.toFixed(0)}ms`);
        }
      }
    };

    // Execute route change measurement after a short delay
    const timeout = setTimeout(routeChangeComplete, 100);

    return () => {
      clearTimeout(timeout);
      disconnectCLS();
      disconnectLCP();
      disconnectFID();
    };
  }, [location]);

  return null;
};

export default PerformanceMonitor;
