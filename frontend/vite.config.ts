import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Enable source maps for production debugging (optional)
    sourcemap: false,
    
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'd3-vendor': ['d3'],
          'ui-vendor': ['lucide-react'],
        },
      },
    },
    
    // Increase chunk size warning limit (default is 500kb)
    chunkSizeWarningLimit: 1000,
    
    // Minification options
    minify: 'esbuild',
    target: 'es2015',
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'd3', 'lucide-react'],
  },
  
  // Development server configuration
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: true,
    },
    hmr: {
      overlay: true,
    },
  },
})
