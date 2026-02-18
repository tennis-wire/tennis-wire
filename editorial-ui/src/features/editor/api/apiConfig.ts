// API endpoints for editor feature.
// Values must be provided via Vite env variables in production.

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export const TRANSCRIBE_API = import.meta.env.VITE_TRANSCRIBE_API_URL ?? 'http://localhost:8001'
