/**
 * API client with automatic Firebase token injection
 */
import { getCurrentUserToken } from '../services/firebase';

/**
 * Error thrown when authentication fails and user needs to re-login
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  let token: string | null;

  try {
    token = await getCurrentUserToken();
  } catch (error: any) {
    // Token refresh failed - user needs to re-authenticate
    // Common causes: session revoked, user deleted, token expired beyond refresh
    console.error('Token refresh failed:', error);
    
    // Redirect to login
    window.location.href = '/login';
    throw new AuthenticationError('Session expired. Please sign in again.');
  }

  if (!token) {
    throw new AuthenticationError('Not authenticated');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Wrapper for authenticated API calls with JSON response
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authenticatedFetch(url, options);

  if (!response.ok) {
    // Handle 401 - token may have been invalidated server-side
    if (response.status === 401) {
      window.location.href = '/login';
      throw new AuthenticationError('Session expired. Please sign in again.');
    }

    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}
