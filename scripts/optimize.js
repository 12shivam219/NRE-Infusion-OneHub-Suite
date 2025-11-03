#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

console.log('🚀 Running production optimizations...');

const distDir = path.resolve(process.cwd(), 'dist', 'public');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/public not found. Run build first.');
  process.exit(1);
}

// Analyze bundle sizes
function analyzeBundle() {
  const jsDir = path.join(distDir, 'js');
  if (!fs.existsSync(jsDir)) return;

  console.log('\n📊 Bundle Analysis:');
  const files = fs.readdirSync(jsDir);
  let totalSize = 0;

  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(jsDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      totalSize += stats.size;
      
      let emoji = '📦';
      if (file.includes('vendor-react')) emoji = '⚛️';
      else if (file.includes('vendor-ui')) emoji = '🎨';
      else if (file.includes('vendor-docs')) emoji = '📄';
      else if (file.includes('vendor-')) emoji = '📚';
      
      console.log(`  ${emoji} ${file}: ${sizeKB} KB`);
    }
  });

  console.log(`\n📈 Total JS bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
  
  if (totalSize > 1024 * 1024) { // > 1MB
    console.log('⚠️  Bundle size is large. Consider code splitting or lazy loading.');
  } else {
    console.log('✅ Bundle size looks good!');
  }
}

// Check for unused assets
function checkUnusedAssets() {
  console.log('\n🔍 Checking for optimization opportunities...');
  
  const imgDir = path.join(distDir, 'img');
  if (fs.existsSync(imgDir)) {
    const images = fs.readdirSync(imgDir);
    let totalImageSize = 0;
    
    images.forEach(img => {
      const imgPath = path.join(imgDir, img);
      const stats = fs.statSync(imgPath);
      totalImageSize += stats.size;
    });
    
    console.log(`📸 Total image assets: ${images.length} files, ${(totalImageSize / 1024).toFixed(2)} KB`);
  }
  
  // Check CSS
  const cssDir = path.join(distDir, 'css');
  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir);
    let totalCssSize = 0;
    
    cssFiles.forEach(css => {
      if (css.endsWith('.css')) {
        const cssPath = path.join(cssDir, css);
        const stats = fs.statSync(cssPath);
        totalCssSize += stats.size;
      }
    });
    
    console.log(`🎨 Total CSS size: ${(totalCssSize / 1024).toFixed(2)} KB`);
  }
}

// Performance recommendations
function performanceRecommendations() {
  console.log('\n💡 Performance Recommendations:');
  console.log('  ✅ Enable gzip/brotli compression on your server');
  console.log('  ✅ Set proper cache headers (Cache-Control: max-age=31536000 for assets)');
  console.log('  ✅ Use a CDN for static assets');
  console.log('  ✅ Enable HTTP/2 on your server');
  console.log('  ✅ Consider implementing service worker for caching');
  console.log('  ✅ Monitor Core Web Vitals in production');
  console.log('');
  console.log('🎯 Additional Optimizations Applied:');
  console.log('  • SuperDoc library: Split into separate chunks (styles, wasm, workers)');
  console.log('  • Document libs: html2canvas, jspdf, jszip marked for lazy loading');
  console.log('  • React-DOM: Separated into own chunk for better caching');
  console.log('  • APIs: Google & Microsoft Graph APIs in separate chunks');
  console.log('  • Image processing: Jimp library in dedicated lazy-load chunk');
  console.log('  • Utilities: date-fns, lodash split separately to improve caching');
  console.log('');
  console.log('📊 Implementation Tips:');
  console.log('  1. Use utils/lazyLoad.ts for importing heavy dependencies on-demand');
  console.log('  2. Implement React.lazy() for route-based code splitting');
  console.log('  3. Add prefetching for anticipated user actions');
  console.log('  4. Monitor Network tab in DevTools to verify chunk loading');
  console.log('  5. Use preload/prefetch hints for critical chunks');
}

// Run all checks
analyzeBundle();
checkUnusedAssets();
performanceRecommendations();

console.log('\n🎉 Optimization analysis complete!');
