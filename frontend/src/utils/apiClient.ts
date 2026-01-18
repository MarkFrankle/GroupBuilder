/**
 * API client with automatic Firebase token injection
 */
import { getCurrentUserToken } from '../services/firebase';

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getCurrentUserToken();

  if (!token) {
    throw new Error('Not authenticated');
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
        // For 403, provide a clearer message
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
