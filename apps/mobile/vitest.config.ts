import { defineConfig } from 'vitest/config'

// Scoped to lib/ on purpose. Anything under app/ or components/ imports
// react-native and expo-* packages that rely on Metro's platform-extension
// resolution (.ios.js / .native.js); plain Node cannot load them, so vitest
// cannot either. Component-level tests would need jest-expo, a separate
// setup this does not attempt yet. lib/ modules that need those packages at
// runtime (session.ts, refresh.ts) stay untested here for the same reason;
// their pure parts are split out (see lib/auth/freshness.ts) precisely so
// something is still covered.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['lib/**/*.test.ts'],
        env: {
            // api.ts calls gatewayOrigin() eagerly; tests never assert the exact URL, only
            // method/headers/retry behavior, so any well-formed value is fine here.
            EXPO_PUBLIC_GATEWAY_ORIGIN: 'http://gateway.test',
        },
    },
})
