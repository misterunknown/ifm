import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// IFM ships as a single PHP file, so the frontend must also collapse into a
// deterministic pair of artifacts that compiler.php can inline:
//
//   frontend/dist/ifm-frontend.js   -> inlined by src/assets.js
//   frontend/dist/ifm-frontend.css  -> inlined by src/assets.css
//
// Fixed file names (no content hashes) keep the compiler dumb on purpose.
// Fonts and other small assets are inlined as base64 so the CSS is
// self-contained and works offline in the bundled flavour.
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    // Single-file distribution: one big bundle is the point, not a problem.
    chunkSizeWarningLimit: 3000,
    assetsInlineLimit: 100 * 1024 * 1024,
    rollupOptions: {
      output: {
        // IIFE (not ESM): the bundle is inlined into a plain <script> tag by
        // compiler.php, where import/export statements would be a syntax error.
        format: 'iife',
        entryFileNames: 'ifm-frontend.js',
        chunkFileNames: 'ifm-frontend.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'ifm-frontend.css'
          return '[name][extname]'
        },
      },
    },
  },
  server: {
    port: 5173,
    // During `npm run dev`, proxy the PHP backend API to a local PHP server,
    // e.g.: php -S 127.0.0.1:8080 -t /path/to/ifm/root
    // then open http://127.0.0.1:5173/?api-dev=http://127.0.0.1:8080/index.php
    // (see src/api.ts for the api-dev override).
  },
})
