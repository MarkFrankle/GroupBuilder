import {
  getRoster, upsertParticipant, deleteParticipant, generateFromRoster, saveRosterOrder, uploadRoster,
} from '@/api/roster';
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
      json: async () => ({ assignment_set_id: 'abc', rebuilt: true, message: 'Sessions rebuilt.' }),
    } as Response);

    const result = await generateFromRoster('test-program-id', 3, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/roster/generate?program_id=test-program-id', expect.objectContaining({
      method: 'POST',
    }));
    expect(result.assignment_set_id).toBe('abc');
    expect(result.rebuilt).toBe(true);
  });

  test('saveRosterOrder sends the ids in order', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);

    await saveRosterOrder('test-program-id', ['p2', 'p1']);

    expect(mockFetch).toHaveBeenCalledWith('/api/roster/order?program_id=test-program-id', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ ids: ['p2', 'p1'] }),
    }));
  });

  test('saveRosterOrder throws when the server refuses', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) } as Response);
    await expect(saveRosterOrder('test-program-id', ['p1'])).rejects.toThrow();
  });

  test('uploadRoster sends participants in last-name order', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    const person = (name: string) => ({
      name, religion: 'Other' as const, gender: 'Other' as const, is_facilitator: false, partner_name: null,
    });

    await uploadRoster('test-program-id', {
      participants: [person('Cy Brown'), person('Ana Adams')],
      drafts: [],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1]!.body as string);
    expect(body.participants.map((p: { name: string }) => p.name)).toEqual(['Ana Adams', 'Cy Brown']);
  });
});
