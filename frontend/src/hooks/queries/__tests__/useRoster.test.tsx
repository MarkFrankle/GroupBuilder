import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useCanonicalRoster } from '../useRoster'

const mockFetch = jest.fn()
jest.mock('@/utils/apiClient', () => ({ authenticatedFetch: (...a: any[]) => mockFetch(...a) }))

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => mockFetch.mockReset())

test('useCanonicalRoster fetches the program-level canonical roster by default', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ participants: [] }) })
  const { result } = renderHook(() => useCanonicalRoster('prog-1'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockFetch).toHaveBeenCalledWith('/api/roster/canonical?program_id=prog-1')
})

test('useCanonicalRoster scopes the request to a specific assignment set when given one', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ participants: [] }) })
  const { result } = renderHook(() => useCanonicalRoster('prog-1', 'set-previous'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/roster/canonical?program_id=prog-1&assignment_set_id=set-previous'
  )
})
