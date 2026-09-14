import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Next has no vite config to hang `test` off, so vitest gets its own.
// Node environment by default: what this app has to test is route handlers,
// not markup. Component tests opt into jsdom per file.
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('.', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['{app,lib,components}/**/*.test.{ts,tsx}'],
    },
})
