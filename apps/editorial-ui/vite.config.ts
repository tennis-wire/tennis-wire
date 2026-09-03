import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        rollupOptions: {
            input: {
                // The dev server serves any root-level .html on its own; a
                // build only emits what is listed here.
                main: resolve(__dirname, 'index.html'),
                'popup-callback': resolve(__dirname, 'popup-callback.html'),
            },
        },
    },
})
