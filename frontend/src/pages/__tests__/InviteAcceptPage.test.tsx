import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';
import InviteAcceptPage from '../InviteAcceptPage';

jest.mock('@/utils/apiClient', () => ({
  apiRequest: (...args: any[]) => mockApiRequest(...args),
}));
const mockApiRequest = jest.fn();

jest.mock('../../services/firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  isSignInWithEmailLink: () => false,
  signInWithEmailLink: jest.fn(),
}));

const authState = { user: { uid: 'u1', email: 'invitee@example.com' } as any, loading: false };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }));

const mockSetCurrentProgram = jest.fn();
const mockRefreshPrograms = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/ProgramContext', () => ({
  useProgram: () => ({ setCurrentProgram: mockSetCurrentProgram, refreshPrograms: mockRefreshPrograms }),
}));

const inviteDetails = {
  program_id: 'prog-new',
  program_name: 'Program New',
  invited_email: 'invitee@example.com',
  expires_at: '2099-01-01T00:00:00Z',
  status: 'pending',
};

function Where() {
  const loc = useLocation();
  return <div>at:{loc.pathname}</div>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/invite/tok-123']}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('InviteAcceptPage', () => {
  beforeEach(() => {
    // CRA's jest config sets resetMocks: true, which wipes any implementation
    // set on a jest.fn() before every test — so these have to be (re)installed
    // here, not at module scope, or the awaited calls resolve to undefined.
    mockSetCurrentProgram.mockReset();
    mockRefreshPrograms.mockReset().mockResolvedValue(undefined);
    mockApiRequest.mockReset().mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => inviteDetails,
    }) as any;
  });

  test('selects the newly joined program on accept, not whatever was already selected', async () => {
    renderPage();

    const acceptButton = await screen.findByRole('button', { name: 'Accept Invite' });
    await userEvent.click(acceptButton);

    await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockSetCurrentProgram).toHaveBeenCalledWith({ id: 'prog-new', name: 'Program New' }),
    );

    // mockSetCurrentProgram must run after the refresh, or the auto-select in
    // fetchPrograms can overwrite it back to the stale stored program.
    const refreshOrder = mockRefreshPrograms.mock.invocationCallOrder[0];
    const selectOrder = mockSetCurrentProgram.mock.invocationCallOrder[0];
    expect(refreshOrder).toBeLessThan(selectOrder);
  });
});
