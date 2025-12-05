import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const geminiApiKey = env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? '';

  return {
    plugins: [react()],
    server: {
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(geminiApiKey),
    },
  };
});