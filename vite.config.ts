import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Allow Vitest `test` config while using Vite's types
const config: any = {
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-openai': ['openai'],
          'vendor-pdf': ['pdfjs-dist'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-ui': ['lucide-react', 'axios', 'file-saver']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
}

export default defineConfig(config)
