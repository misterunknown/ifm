import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// IFM backend used by `npm run dev`. The PHP API and the Vite dev server
// stay same-origin through the /__ifm_api proxy, so session cookies and the
// X-IFM-CSRF header behave exactly like in production (single-file dist).
// Point VITE_IFM_BACKEND at a running PHP backend, e.g.:
//   php -S 127.0.0.1:8080 dist/vue.ifm.php   (or tests/server/index.php via dist/libifm.php)
//   VITE_IFM_BACKEND=http://127.0.0.1:8080 npm run dev
const backend = process.env.VITE_IFM_BACKEND || 'http://127.0.0.1:8080';

/**
 * Drops the Font Awesome SVG font from the bundle. Vite inlines every other
 * font format as a data URI, but the legacy SVG fallback (iOS 4-era) is
 * always emitted as a separate file, which the single-file PHP dist cannot
 * serve. Modern browsers use the inlined woff2 instead.
 */
function dropSvgFont() {
    return {
        name: 'ifm-drop-svg-font',
        generateBundle(_options, bundle) {
            for (const [name, chunk] of Object.entries(bundle)) {
                if (name.endsWith('.svg')) {
                    delete bundle[name];
                } else if (name.endsWith('.css') && chunk.type === 'asset') {
                    chunk.source = chunk.source.replace(/url\([^)]*\.svg[^)]*\)\s*format\(["']svg["']\),?\s*/g, '');
                }
            }
        },
    };
}

export default defineConfig({
    plugins: [vue(), dropSvgFont()],
    server: {
        proxy: {
            '/__ifm_api': {
                target: backend,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/__ifm_api/, '/index.php'),
            },
        },
    },
    build: {
        // Single-file output is intentional (embedded into dist/vue.ifm.php).
        chunkSizeWarningLimit: 3000,
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        // Inline images/fonts as data URIs so the compiler can embed the
        // bundle into the single-file PHP dist and work fully offline,
        // matching the "bundled" flavour of the legacy frontend.
        assetsInlineLimit: 100000000,
        rollupOptions: {
            output: {
                // Single JS + single CSS file: the PHP compiler inlines them
                // into dist/vue.ifm.php. No code-splitting, no dynamic chunks.
                inlineDynamicImports: true,
                entryFileNames: 'ifm-vue.js',
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'ifm-vue.css';
                    return '[name].[ext]';
                },
            },
        },
    },
    test: {
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary'],
            include: ['src/**/*.js', 'src/**/*.vue'],
            // main.js is the 12-line app bootstrap (createApp/provide/mount)
            // with no logic: importing it mounts the whole app as a side
            // effect, so it cannot be unit-tested in isolation.
            exclude: ['src/main.js'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
