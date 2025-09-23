import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    include: ['axios', 'cheerio', 'url-parse', 'bootstrap', '@popperjs/core']
  },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true, // Suppress deprecation warnings from dependencies
        silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin', 'color-functions']
      }
    }
  }
}); 