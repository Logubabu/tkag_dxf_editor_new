import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/tkag_dxf_editor_new/',
  plugins: [react()],
})
