import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/kaneshow-b1/sake/',
  build: {
    outDir: 'dist/kaneshow-b1/sake'
  }
})
