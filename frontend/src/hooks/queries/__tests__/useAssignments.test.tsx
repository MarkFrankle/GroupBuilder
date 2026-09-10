import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useAcceptRebuild, useUndoRebuild } from '../useAssignments'

const mockFetch = jest.fn()
jest.mock('@/utils/apiClient', () => ({ authenticatedFetch: (...a: any[]) => mockFetch(...a) }))

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

beforeEach(() => mockFetch.mockReset())

test('useAcceptRebuild POSTs /accept', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ accepted: true }) })
  const { result } = renderHook(() => useAcceptRebuild('prog-1'), { wrapper })
  result.current.mutate()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/assignments/accept?program_id=prog-1',
    expect.objectContaining({ method: 'POST' }),
  )
})

test('useUndoRebuild POSTs /undo-rebuild', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ assignment_set_id: 'x' }) })
  const { result } = renderHook(() => useUndoRebuild('prog-1'), { wrapper })
  result.current.mutate()
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockFetch).toHaveBeenCalledWith(
    '/api/assignments/undo-rebuild?program_id=prog-1',
    expect.objectContaining({ method: 'POST' }),
  )
})
