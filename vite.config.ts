import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
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
    },
  },
});
