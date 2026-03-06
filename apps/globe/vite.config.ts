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
  server: {
    proxy: {
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
