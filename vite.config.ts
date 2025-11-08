import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "path";
import { fileURLToPath } from "url";
import viteImagemin from 'vite-plugin-imagemin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
// Some versions of vite-plugin-imagemin export default differently; normalize it safely
const imageminFactory: any = (viteImagemin as any)?.default ?? (viteImagemin as any);

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    'process.env': '{}',
    global: 'globalThis'
  },
  envPrefix: ['VITE_'],
  
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
    exclude: ['@harbour-enterprises/superdoc', 'html2canvas', 'jspdf'],
    esbuildOptions: {
      target: 'es2020',
      supported: { 'top-level-await': true },
      treeShaking: true,
      format: 'esm'
    }
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    // Only enable heavy image optimization in production builds (if plugin factory exists)
    isProd && typeof imageminFactory === 'function' && imageminFactory({
      gifsicle: {
        optimizationLevel: 7,
        interlaced: false,
      },
      optipng: {
        optimizationLevel: 7,
      },
      mozjpeg: {
        quality: 80,
      },
      pngquant: {
        quality: [0.8, 0.9],
        speed: 4,
      },
      webp: {
        quality: 75,
      },
    })
  ].filter(Boolean) as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
    build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    target: ['es2022', 'chrome89', 'edge89', 'firefox89', 'safari15'],
    sourcemap: process.env.NODE_ENV !== 'production',
    cssCodeSplit: true,
    reportCompressedSize: false,
    assetsInlineLimit: 4096, // 4kb - optimized for HTTP/2
    chunkSizeWarningLimit: 3000, // Increased due to document handling libraries
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3,
        unsafe_arrows: true,
        unsafe_methods: true,
        reduce_vars: true,
        reduce_funcs: true,
        pure_getters: true,
        keep_fargs: false,
        unused: true,
        dead_code: true,
        toplevel: true,
        hoist_funs: true,
        hoist_vars: false,
        if_return: true,
        inline: 3,
        join_vars: true,
        loops: true,
        side_effects: true
      },
      mangle: {
        safari10: true,
        properties: {
          regex: /^_/
        },
        toplevel: true,
        eval: true
      },
      format: {
        comments: false,
        preserve_annotations: false
      }
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: (id: string) => {
        // Don't bundle puppeteer in production
        if (process.env.NODE_ENV === 'production' && id.includes('puppeteer-core')) return true;
        return false;
      },
      output: {
        globals: {} as Record<string, string>,
        manualChunks: (id: string) => {
          // Route-based code splitting
          if (id.includes('pages/')) {
            const pageName = id.split('pages/')[1].split('/')[0];
            return `page-${pageName}`;
          }

          // Feature-based code splitting
          if (id.includes('node_modules')) {
            // Core libraries - split react-dom separately
            if (id.includes('react-dom')) return 'core-react-dom';
            if (id.includes('react')) return 'core-react';
            if (id.includes('@tanstack/react-query')) return 'core-query';
            
            // Separate large UI libraries
            if (id.includes('@radix-ui/')) return 'ui-radix';
            if (id.includes('framer-motion')) return 'ui-motion';
            if (id.includes('lucide-react')) return 'ui-icons';
            if (id.includes('sonner')) return 'ui-sonner';
            
            // Form handling
            if (id.includes('react-hook-form') || 
                id.includes('@hookform/resolvers') || 
                id.includes('zod')) {
              return 'feature-forms';
            }
            
            // Document handling - LAZY loaded chunks
            if (id.includes('html2canvas')) return 'lib-html2canvas';
            if (id.includes('jspdf')) return 'lib-jspdf';
            if (id.includes('jszip')) return 'lib-jszip';
            if (id.includes('file-saver')) return 'lib-file-saver';
            
            // SuperDoc - critical library, split aggressively
            if (id.includes('@harbour-enterprises/superdoc')) {
              if (id.includes('.css')) return 'lib-superdoc-styles';
              if (id.includes('.wasm')) return 'lib-superdoc-wasm';
              if (id.includes('worker')) return 'lib-superdoc-workers';
              return 'lib-superdoc';
            }
            
            // API/Database
            if (id.includes('googleapis') || id.includes('@microsoft/microsoft-graph-client')) {
              return 'lib-api';
            }
            
            // Image processing - lazy loaded
            if (id.includes('jimp') || id.includes('html2canvas')) {
              return 'lib-image';
            }
            
            // Utilities - keep minimal
            if (id.includes('date-fns')) return 'util-date';
            if (id.includes('lodash')) return 'util-lodash';
            if (id.includes('uuid') || id.includes('nanoid')) return 'util-id';

            // Group remaining dependencies
            return 'vendor';
          }

          // Component-based code splitting
          if (id.includes('components/')) {
            if (id.includes('components/ui/')) return 'comp-ui';
            if (id.includes('components/SuperDocEditor/')) return 'comp-superdoc-editor';
            if (id.includes('components/email/')) return 'comp-email';
            if (id.includes('components/marketing/')) {
              if (id.includes('requirements-section')) return 'comp-marketing-requirements';
              if (id.includes('consultants-section') || id.includes('interviews-section')) {
                return 'comp-marketing-sections';
              }
              return 'comp-marketing-other';
            }
            if (id.includes('components/admin/')) return 'comp-admin';
            return 'comp-shared';
          }
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return `assets/[name]-[hash][extname]`;
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `img/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    modulePreload: {
      polyfill: false, // Disable module preload polyfill to reduce bundle size
      resolveDependencies: (filename: string, deps: string[]) => {
        // Prioritize loading of critical dependencies
        if (filename.includes('superdoc')) {
          return deps.sort((a, b) => {
            if (a.includes('style.css')) return -1;
            if (b.includes('style.css')) return 1;
            if (a.includes('worker')) return 1;
            if (b.includes('worker')) return -1;
            return 0;
          });
        }
        return deps;
      }
    },
    manifest: true,
    ssrManifest: false,
    write: true,
    dynamicImportVarsOptions: {
      warnOnError: true,
      exclude: [],
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    fs: {
      strict: false,
      allow: ['..']
    },
    hmr: {
      protocol: 'ws',
      port: 24678,
      clientPort: 24678,
      host: 'localhost'
    },
    host: true,
    port: 5000,
    strictPort: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:; connect-src 'self' data: blob: ws: wss: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; style-src 'self' 'unsafe-inline' data: blob:;"
    }
  },
});
