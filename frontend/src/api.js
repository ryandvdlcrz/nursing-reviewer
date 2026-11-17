const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
const TOKEN_KEY = 'thaling_token'
const SLOW_AFTER_MS = 4000
const TIMEOUT_MS = 120000

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

export function setToken(token, remember) {
  clearToken()
  const storage = remember ? localStorage : sessionStorage
  storage.setItem(TOKEN_KEY, token)
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

let onUnauthorized = () => {}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

// Tracks requests that are taking a long time, so the app can show a message
let slowCount = 0
const slowListeners = new Set()

function notifySlow() {
  slowListeners.forEach((listener) => listener())
}

export function subscribeSlow(listener) {
  slowListeners.add(listener)
  return () => slowListeners.delete(listener)
}

export function getSlow() {
  return slowCount > 0
}

function trackSlow() {
  let marked = false
  const timer = setTimeout(() => {
    marked = true
    slowCount += 1
    notifySlow()
  }, SLOW_AFTER_MS)

  return () => {
    clearTimeout(timer)
    if (marked) {
      slowCount -= 1
      notifySlow()
    }
  }
}

// Quietly pings the server so a sleeping server starts waking up early
export function wakeServer() {
  const stopTracking = trackSlow()
  fetch(`${API_URL}/health`)
    .catch(() => {
      // nothing to do, real requests show their own errors
    })
    .finally(stopTracking)
}

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken()
  const isForm = body instanceof FormData

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const stopTracking = trackSlow()

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    throw new ApiError(
      0,
      err?.name === 'AbortError'
        ? 'The server is taking too long to respond. Please try again.'
        : 'Cannot reach the server. Check your connection and try again.',
    )
  } finally {
    clearTimeout(timeout)
    stopTracking()
  }

  if (response.status === 401 && token) {
    clearToken()
    onUnauthorized()
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') message = data.detail
    } catch {
      // response had no JSON body, keep the default message
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return null
  return response.json()
}

export const login = (passcode) =>
  api('/auth/login', { method: 'POST', body: { passcode } })