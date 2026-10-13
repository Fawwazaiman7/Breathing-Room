import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. Impor tailwind

// https://vite.dev
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. Tambahkan ke dalam array plugins
  ],
})
