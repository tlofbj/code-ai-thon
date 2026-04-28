/**
 * Optional absolute API origin (build-time): `VITE_API_BASE_URL=http://localhost:5001`
 *
 * Default behavior is same-origin `/api` so Vite dev (`:5173`) uses `vite.config.js` proxy.
 * This keeps frontend requests on 5173 while forwarding API traffic to Express.
 */
export const EXPECTED_API_VERSION = '2026-04-28-offer-queue-v1'

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const explicit = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  if (explicit) return `${explicit}${p}`
  return p
}

export function apiFetch(path, init) {
  return fetch(apiUrl(path), init)
}
