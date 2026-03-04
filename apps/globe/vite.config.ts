import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';
import { resolve } from 'path';

export default defineConfig({
  plugins: [cesium({
    rebuildCesium: true,
    cesiumBuildPath: resolve(__dirname, '../../node_modules/cesium/Build/Cesium'),
  })],
  optimizeDeps: {
    esbuildOptions: {
      sourcemap: 'inline',
    },
  },
  // COOP/COEP disabled — blocks MapTiler tile loading.
  // Nankai scenario uses SAB fallback (slower but functional).
  // Re-evaluate when CF Workers proxy is in place (same-origin tiles).
  server: {
    proxy: {
      // Dev proxy for MapTiler — avoids CORS issues and properly surfaces 429 status
      '/maptiler-proxy': {
        target: 'https://api.maptiler.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/maptiler-proxy/, ''),
      },
      '/plateau-proxy': {
        target: 'https://plateau.geospatial.jp',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/plateau-proxy/, ''),
      },
      // Dev proxy for Namazue API (worker running on localhost:8787)
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
