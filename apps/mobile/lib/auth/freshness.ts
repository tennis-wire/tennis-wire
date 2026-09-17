// Split out of refresh.ts on purpose: that file pulls in expo-auth-session,
// which needs Metro's platform-extension resolution and cannot load under
// plain Node, so vitest can never import it directly. This one has no
// runtime imports at all, so it can.

const EARLY_SECONDS = 30

export function isFresh(accessExpiresAt: number, now: number = Date.now()): boolean {
    return accessExpiresAt - EARLY_SECONDS > Math.floor(now / 1000)
}
