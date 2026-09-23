import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";

// import.meta.dirname is not available under Vite's `configLoader: "native"`,
// and bare __dirname is what the loader warns about on every build. Deriving it
// from import.meta.url works under both loaders and silences the warning
// without changing what the alias resolves to.
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),

    // index.html preconnects to api.sphpnp.com. A build pointed at another
    // backend preconnects to that instead.
    {
      name: "supabase-preconnect",
      transformIndexHtml(html: string) {
        const url = process.env.VITE_SUPABASE_URL;
        return url ? html.replace("https://api.sphpnp.com", new URL(url).origin) : html;
      },
    },

    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        // HTML is deliberately NOT precached. Every route is prerendered with
        // whatever the page showed at build time, and a precached copy served a
        // returning visitor that snapshot - old prices included - before the
        // live feed replaced them. Hashed JS/CSS/images stay precached (they
        // cannot go stale); pages always come from the network first.
        globPatterns: ['**/*.{js,css,ico,png,svg,jpg,jpeg,webp}'],
        // The precache is downloaded in full on a first visit. The certificate
        // scans (6.5 MB of PNG), the illustrations (served AVIF-first and cached
        // by the browser anyway) and the share images are never needed offline.
        globIgnores: ['**/cert*.png', 'illustrations/**', 'og-*.jpg', 'videos/**'],
        maximumFileSizeToCacheInBytes: 5000000, // 5MB limit
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Pages: network first, the cached copy only when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4, expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 } },
          },
          // No route for market data (Supabase, Yahoo) on purpose: a request no
          // route matches is never touched by the worker, so prices always come
          // straight from the network. A NetworkOnly route would only make the
          // worker proxy those calls - same result, extra hop - and it hid them
          // from Playwright's request mocking, breaking the modal-stacking e2e.
        ],
      },
      manifest: {
        name: 'Parasram India - Panipat',
        short_name: 'Parasram',
        description: 'Best Stock Broker in Panipat | Legacy Stock Brokers Since 1970',
        theme_color: '#0A192F',
        background_color: '#0A192F',
        display: 'standalone',
        icons: [
          {
            src: '/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    }),

    // Bundle breakdown: npm run analyze -> dist/stats.html
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
      })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // Rolldown ignores the old manualChunks priority: a group also captures
        // its dependencies, so recharts pulled clsx into chart-vendor and every
        // page preloaded the 89 KB chart chunk just to reach clsx. Groups with an
        // explicit priority win that tie. Higher priority is matched first.
        codeSplitting: {
          groups: [
            // React core (anchored, so react-* siblings stay out) plus the tiny
            // utils the app shares with recharts, which must not follow recharts
            // into chart-vendor.
            { name: 'react-vendor', priority: 60, test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|clsx|tailwind-merge|class-variance-authority)[\\/]/ },
            { name: 'animation-vendor', priority: 50, test: /node_modules[\\/](motion|framer-motion)[\\/]/ },
            { name: 'ui-vendor', priority: 40, test: /node_modules[\\/](@radix-ui|lucide-react)[\\/]/ },
            { name: 'query-vendor', priority: 40, test: /node_modules[\\/]@tanstack[\\/]react-query[\\/]/ },
            { name: 'chart-vendor', priority: 20, test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/ },
            { name: 'supabase-vendor', priority: 20, test: /node_modules[\\/]@supabase[\\/]/ },
          ],
        },
      },
    },
  }
}));
