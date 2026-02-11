import { getRoster, upsertParticipant, deleteParticipant, generateFromRoster } from '@/api/roster';
import { authenticatedFetch } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

describe('roster API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getRoster calls GET /api/roster/', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ participants: [] }),
    } as Response);

    const result = await getRoster();
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/');
    expect(result).toEqual([]);
  });

  test('upsertParticipant calls PUT with data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'p1', name: 'Alice' }),
    } as Response);

    await upsertParticipant('p1', {
      name: 'Alice', religion: 'Christian',
      gender: 'Female', partner_id: null,
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1', expect.objectContaining({
      method: 'PUT',
    }));
  });

  test('deleteParticipant calls DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    await deleteParticipant('p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/p1', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  test('generateFromRoster calls POST /api/roster/generate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ session_id: 'abc' }),
    } as Response);

    const result = await generateFromRoster(3, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/generate', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toBe('abc');
  });
});
