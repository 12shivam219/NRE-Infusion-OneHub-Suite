/**
 * Safe dynamic import wrapper for lazy loading heavy dependencies
 */

export async function lazyImport<T = any>(importFn: () => Promise<T>, timeout = 10000): Promise<T> {
  return Promise.race([
    importFn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Lazy import timeout')), timeout)
    ),
  ]);
}

/**
 * Lazy load document handling libraries
 */
export async function lazyLoadDocumentLibraries() {
  const [html2canvas, jsPDF, JSZip] = await Promise.all([
    lazyImport(() => import('html2canvas').then(m => m.default)),
    lazyImport(() => import('jspdf').then(m => m.jsPDF)),
    lazyImport(() => import('jszip')),
  ]);

  return { html2canvas, jsPDF, JSZip };
}

/**
 * Lazy load image processing
 */
export async function lazyLoadImageProcessing() {
  return lazyImport(() => import('jimp'));
}

/**
 * Lazy load SuperDoc editor
 */
export async function lazyLoadSuperDoc() {
  return lazyImport(() => import('@harbour-enterprises/superdoc'));
}

/**
 * Lazy load Google APIs
 */
export async function lazyLoadGoogleApis() {
  return lazyImport(() => import('googleapis'));
}

/**
 * Lazy load Microsoft Graph
 */
export async function lazyLoadMicrosoftGraph() {
  return lazyImport(() => import('@microsoft/microsoft-graph-client'));
}

/**
 * Create lazy component wrapper for React components
 */
export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: React.ComponentType<P> }>
) {
  return import('react').then(({ lazy, Suspense }) => {
    const Component = lazy(importFn);
    return { Component, Suspense };
  });
}
