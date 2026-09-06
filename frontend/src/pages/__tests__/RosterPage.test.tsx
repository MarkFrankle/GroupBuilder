import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RosterPage } from '../RosterPage';
import { authenticatedFetch } from '@/utils/apiClient';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

jest.mock('@/contexts/ProgramContext', () => ({
  useProgram: () => ({
    currentProgram: { id: 'test-program-id', name: 'Test' },
    programs: [],
    loading: false,
    needsProgramSelection: false,
    setCurrentProgram: jest.fn(),
    refreshPrograms: jest.fn(),
  }),
}));

const renderPage = () => {
  const QueryWrapper = createQueryWrapper();
  return render(
    <BrowserRouter>
      <QueryWrapper>
        <RosterPage />
      </QueryWrapper>
    </BrowserRouter>
  );
};

describe('RosterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      // No assignment set yet for this program
      if (url.includes('/api/assignments/metadata')) {
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ participants: [] }),
      } as Response);
    });
  });

  test('renders page title', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Roster')).toBeInTheDocument();
    });
  });

  test('loads and displays participants', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        participants: [
          { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null },
        ],
      }),
    } as Response);
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeInTheDocument();
    });
  });

  test('renders table and session selectors', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Number of Tables')).toBeInTheDocument();
    });
    expect(screen.getByText('Number of Sessions')).toBeInTheDocument();
  });

  test('renders generate button', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generate Assignments/i })).toBeInTheDocument();
    });
  });

  test('shows saving indicator', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    });
  });
});

describe('RosterPage with an existing assignment set', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/assignments/metadata')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ assignment_set_id: 's1', num_tables: 4, num_sessions: 2 }),
        } as Response);
      }
      if (url.includes('/api/assignments/results')) {
        return Promise.resolve({ ok: true, json: async () => [] } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          participants: [
            { id: 'p1', name: 'Alice', religion: 'Christian', gender: 'Female', partner_id: null },
            { id: 'p2', name: 'Bob', religion: 'Jewish', gender: 'Male', partner_id: null },
            { id: 'p3', name: 'Cara', religion: 'Muslim', gender: 'Female', partner_id: null },
            { id: 'p4', name: 'Dan', religion: 'None', gender: 'Male', partner_id: null },
          ],
        }),
      } as Response);
    });
  });

  test('shows both regeneration tabs', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /Regenerate/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fresh Start/i })).toBeInTheDocument();
  });

  test('describes the layout the existing set will preserve', async () => {
    renderPage();
    expect(
      await screen.findByText(/Keeps the existing layout: 4 tables × 2 sessions\./)
    ).toBeInTheDocument();
  });

  test('enables the regenerate button when there are enough participants', async () => {
    renderPage();
    await screen.findByDisplayValue('Alice');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Regenerate All Sessions/i })).toBeEnabled();
    });
  });
});
