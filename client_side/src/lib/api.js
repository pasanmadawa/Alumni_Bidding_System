export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export function getStoredAuth() {
  return {
    accessToken: localStorage.getItem('accessToken') || '',
    refreshToken: localStorage.getItem('refreshToken') || '',
    user: JSON.parse(localStorage.getItem('authUser') || 'null'),
  }
}

export function saveAuth(result) {
  if (result.accessToken) localStorage.setItem('accessToken', result.accessToken)
  if (result.refreshToken) localStorage.setItem('refreshToken', result.refreshToken)
  if (result.user) localStorage.setItem('authUser', JSON.stringify(result.user))
}

export function clearAuth() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('authUser')
}

export function assetUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path}`
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const { accessToken } = getStoredAuth()

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })
  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json') ? await response.json() : await response.text()

  if (!response.ok) {
    const message = typeof result === 'string'
      ? result
      : result.message || result.error || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    error.payload = result
    throw error
  }

  return result
}

export async function logoutRequest() {
  const { refreshToken } = getStoredAuth()

  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    })
  } finally {
    clearAuth()
  }
}
