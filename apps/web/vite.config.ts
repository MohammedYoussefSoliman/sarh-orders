import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * The dev server proxies `/api` to the NestJS app, so the browser sees a single
 * origin. That is what lets the session cookie be `SameSite=Strict` with no CORS
 * exemption: to the browser, the API is simply part of this site.
 */
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('./environments', import.meta.url));
  const env = loadEnv(mode, envDir, '');

  return {
    envDir,
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: Number(env.PORT) || 5180,
      host: env.DEV_LOCAL_HOST || 'localhost',
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: false,
        },
      },
    },
    build: { outDir: 'build', emptyOutDir: true },
  };
});
