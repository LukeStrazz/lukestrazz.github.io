import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // three.js changes far less often than site content, so give it its
        // own chunk with its own hash — repeat visitors keep it cached across
        // deploys instead of refetching it whenever copy changes.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined)
      }
    }
  }
});
