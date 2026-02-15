import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RosterPage } from '../RosterPage';
import { authenticatedFetch } from '@/utils/apiClient';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

jest.mock('@/utils/apiClient');
const mockFetch = authenticatedFetch as jest.MockedFunction<typeof authenticatedFetch>;

const renderPage = () => render(<BrowserRouter><RosterPage /></BrowserRouter>);

describe('RosterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ participants: [] }),
    } as Response);
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
