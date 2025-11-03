import { lazy, Suspense } from 'react';
import { PageLoader } from '@/components/ui/page-loader';

// Lazy load SuperDocEditor to keep it out of initial bundle
const SuperDocEditorComponent = lazy(() =>
  import('./SuperDocEditor').then(m => ({ default: m.SuperDocEditor }))
);

// Lazy preload function for anticipated usage
export const preloadSuperDocEditor = () => {
  if (typeof window !== 'undefined') {
    // Preload on idle callback
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        import('./SuperDocEditor').catch(() => {});
      });
    }
  }
};

interface SuperDocEditorLazyProps {
  fileUrl: string;
  fileName?: string;
  resumeId: string;
  onSave?: (content: any) => void;
  onExport?: (file: Blob) => void;
  className?: string;
  height?: string;
}

export function SuperDocEditorLazy(props: SuperDocEditorLazyProps) {
  return (
    <Suspense 
      fallback={
        <PageLoader 
          variant="branded" 
          text="Loading editor..." 
          subText="Initializing SuperDoc"
        />
      }
    >
      <SuperDocEditorComponent {...props} />
    </Suspense>
  );
}
