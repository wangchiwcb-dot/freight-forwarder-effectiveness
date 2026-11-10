import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'dist/client',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor'))
              return 'charts';
            if (
              id.includes('antd') ||
              id.includes('@ant-design') ||
              id.includes('rc-') ||
              id.includes('@rc-component')
            )
              return 'ui';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
  },
  server: {
    host: '127.0.0.1',
    proxy: { '/api': 'http://127.0.0.1:3001', '/health': 'http://127.0.0.1:3001' },
    allowedHosts: ['terminal.local'],
    warmup: {
      clientFiles: ['./src/main.tsx'],
    },
  },
  preview: { proxy: { '/api': 'http://127.0.0.1:3001', '/health': 'http://127.0.0.1:3001' } },
  plugins: [react()],
});
