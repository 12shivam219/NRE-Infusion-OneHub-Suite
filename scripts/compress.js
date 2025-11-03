#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

async function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const COMPRESSIBLE_EXTS = new Set([
    '.js',
    '.css',
    '.html',
    '.json',
    '.svg',
    '.xml',
    '.txt',
    '.map',
    '.wasm',
  ]);

  if (!COMPRESSIBLE_EXTS.has(ext)) return;

  const file = await fs.promises.readFile(filePath);
  const originalSize = file.length;

  // Enhanced size threshold based on file type
  const MIN_SIZE = ext === '.js' || ext === '.css' ? 2048 : 1024; // 2KB for JS/CSS, 1KB for others
  if (originalSize < MIN_SIZE) return;

  // Compression promises
  const compressionTasks = [];

  // gzip compression with optimized settings
  compressionTasks.push(
    new Promise((resolve, reject) => {
      zlib.gzip(
        file,
        {
          level: zlib.constants.Z_BEST_COMPRESSION,
          windowBits: 15,
          memLevel: 9,
          strategy: zlib.constants.Z_RLE, // Better for text-based files
        },
        async (err, gz) => {
          if (err) reject(err);
          else {
            await fs.promises.writeFile(filePath + '.gz', gz);
            resolve({
              type: 'gzip',
              size: gz.length,
              ratio: (((originalSize - gz.length) / originalSize) * 100).toFixed(1),
            });
          }
        }
      );
    })
  );

  // brotli compression with optimized settings
  if (typeof zlib.brotliCompressSync === 'function') {
    compressionTasks.push(
      new Promise((resolve, reject) => {
        zlib.brotliCompress(
          file,
          {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
              [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: originalSize,
              [zlib.constants.BROTLI_PARAM_LGWIN]: 24, // Larger window size for better compression
            },
          },
          async (err, br) => {
            if (err) reject(err);
            else {
              await fs.promises.writeFile(filePath + '.br', br);
              resolve({
                type: 'brotli',
                size: br.length,
                ratio: (((originalSize - br.length) / originalSize) * 100).toFixed(1),
              });
            }
          }
        );
      })
    );
  }

  // Wait for all compression tasks to complete
  try {
    const results = await Promise.all(compressionTasks);

    // Log compression stats for larger files or significant compression gains
    const bestCompression = results.reduce((best, current) =>
      parseFloat(current.ratio) > parseFloat(best.ratio) ? current : best
    );

    if (originalSize > 50000 || parseFloat(bestCompression.ratio) > 70) {
      console.log(
        `${path.basename(filePath)} (${(originalSize / 1024).toFixed(1)}KB) → ` +
          results.map((r) => `${r.type}: ${(r.size / 1024).toFixed(1)}KB (${r.ratio}%)`).join(', ')
      );
    }
  } catch (error) {
    console.error(`Error compressing ${filePath}:`, error.message);
  }
}

async function walk(dir) {
  const files = await fs.promises.readdir(dir);
  const tasks = [];

  for (const name of files) {
    const full = path.join(dir, name);
    const stat = await fs.promises.stat(full);

    if (stat.isDirectory()) {
      tasks.push(walk(full));
    } else {
      tasks.push(compressFile(full));
    }
  }

  await Promise.all(tasks);
}

// Resolve dist/public relative to the current working directory to support running from project root
const dist = path.resolve(process.cwd(), 'dist', 'public');
if (!fs.existsSync(dist)) {
  console.error('dist/public not found. Run build first.');
  process.exit(1);
}
walk(dist);
console.log('Compression complete');
