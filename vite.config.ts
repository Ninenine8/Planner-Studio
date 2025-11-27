import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '')

  // Render sets environment variables in process.env
  // loadEnv only loads .env files and VITE_ prefixed variables
  // We must explicitly check process.env for the API_KEY
  const apiKey = process.env.API_KEY || env.API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Expose the API_KEY from environment variables to the app code
      'process.env.API_KEY': JSON.stringify(apiKey),
    },
    preview: {
      allowedHosts: ['planner-studio.onrender.com']
    },
    server: {
      allowedHosts: ['planner-studio.onrender.com']
    }
  }
})