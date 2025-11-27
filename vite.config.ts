import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '')

  return {
    plugins: [react()],
    define: {
      // Expose the API_KEY from environment variables to the app code
      // Fallback to empty string to prevent build errors if undefined
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
    },
    preview: {
      allowedHosts: ['planner-studio.onrender.com']
    },
    server: {
      allowedHosts: ['planner-studio.onrender.com']
    }
  }
})