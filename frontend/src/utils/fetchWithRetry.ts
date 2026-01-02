/**
 * Fetch with automatic retry logic for handling transient network failures.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Base delay between retries in ms (default: 1000, uses exponential backoff)
 * @returns Promise resolving to the Response
 * @throws Error if all retry attempts fail
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // Don't retry on 4xx errors (client errors - bad request, not found, etc.)
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
  throw new Error(
    `Failed to fetch ${url} after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
  )
}
