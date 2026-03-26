// API endpoints for editor feature.
// All requests go through API Gateway.
// Values can be overridden via Vite env variables in production.

// API Gateway (routes to all backend services)
export const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:8090'

// Editorial BFF endpoints (AI chat, translate) — via Gateway
export const API_BASE = import.meta.env.VITE_API_URL ?? GATEWAY_URL

// Transcription service — via Gateway
export const TRANSCRIBE_API = import.meta.env.VITE_TRANSCRIBE_API_URL ?? GATEWAY_URL

// Content Service endpoints — via Gateway
export const CONTENT_API = `${GATEWAY_URL}/api/editorial`
