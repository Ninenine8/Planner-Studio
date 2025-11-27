import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['planner-studio.onrender.com']
  },
  server: {
    allowedHosts: ['planner-studio.onrender.com']
  }
})