import { getRoster, upsertParticipant, deleteParticipant, generateFromRoster } from '@/api/roster';
import { authenticatedFetch } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe('roster API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getRoster calls GET /api/roster/ with program_id', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: [] }),
    } as Response);

    const result = await getRoster('test-program-id');
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/?program_id=test-program-id');
    expect(result).toEqual([]);
  });

  test('upsertParticipant calls PUT with data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p1', name: 'Alice' }),
    } as Response);

    await upsertParticipant('test-program-id', 'p1', {
      name: 'Alice', religion: 'Christian',
      gender: 'Female', partner_id: null,
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1?program_id=test-program-id', expect.objectContaining({
      method: 'PUT',
    }));
  });

  test('deleteParticipant calls DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    await deleteParticipant('test-program-id', 'p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1?program_id=test-program-id', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  test('generateFromRoster calls POST /api/roster/generate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: 'abc' }),
    } as Response);

    const result = await generateFromRoster('test-program-id', 3, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/generate?program_id=test-program-id', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toBe('abc');
  });
});
