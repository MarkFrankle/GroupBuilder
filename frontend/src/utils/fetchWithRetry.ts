import { getCurrentUserToken } from '../services/firebase';

/**
 * Fetch with automatic retry logic and authentication for handling transient network failures.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Base delay between retries in ms (default: 1000, uses exponential backoff)
 * @returns Promise resolving to the Response
 * @throws Error if all retry attempts fail or if not authenticated
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  // Get authentication token
  const token = await getCurrentUserToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Add authorization header to options
  const headers = new Headers(options?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  const authenticatedOptions: RequestInit = {
    ...options,
    headers,
  };

  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, authenticatedOptions)

      // Don't retry on 4xx errors (client errors - bad request, not found, unauthorized, rate limited, etc.)
      // Only retry on network errors and 5xx server errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response
      }

      // 5xx error - will retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
    } catch (error) {
      // Network error (no response) - will retry
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    // Don't delay after the last attempt
    if (attempt < maxRetries - 1) {
      // Exponential backoff: 1s, 2s, 4s, ...
      const delay = retryDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // All retries failed
  console.error(
    `Failed to fetch ${url} after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  );
  throw new Error(
    "Couldn't reach the server. Check your connection and try again."
  )
}
