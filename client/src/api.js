// =========================================================================
// CiviCare: API Client Helper
// =========================================================================

const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('civicare_token');
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('civicare_token', token);
  } else {
    localStorage.removeItem('civicare_token');
  }
}

export async function apiFetch(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }
  return data;
}
