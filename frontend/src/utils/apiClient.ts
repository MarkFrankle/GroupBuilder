/**
 * API client with automatic Firebase token injection
 */
import { getCurrentUserToken } from '../services/firebase';
import { API_BASE_URL } from '../config/api';

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

  // Prepend API_BASE_URL to relative paths so they hit the backend, not the SPA host
  const resolvedUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

  return fetch(resolvedUrl, {
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

    // Try to parse error as JSON, fallback to text if it fails
    let errorMessage = `HTTP ${response.status}`;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        errorMessage = error.detail || errorMessage;
      } else {
        // Non-JSON response (likely HTML error page)
        const text = await response.text();
        if (response.status === 403) {
          errorMessage = 'Access denied. You may not have admin privileges.';
        } else {
          errorMessage = text.substring(0, 100) || errorMessage;
        }
      }
    } catch (e) {
      // Keep the default HTTP status message
    }

    throw new Error(errorMessage);
  }

  return response.json();
}
