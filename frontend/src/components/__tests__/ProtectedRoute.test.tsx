import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import ProgramSelectorPage from '@/pages/ProgramSelectorPage';

jest.mock('@/utils/apiClient');

const programState = {
  currentProgram: null as { id: string; name: string } | null,
  programs: [
    { id: 'program-a', name: 'Program A' },
    { id: 'program-b', name: 'Program B' },
  ],
  loading: false,
  needsProgramSelection: true,
};

const authState = { user: { email: 'user@example.com' } as { email: string } | null };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}));

jest.mock('@/contexts/ProgramContext', () => ({
  useProgram: () => ({
    ...programState,
    setCurrentProgram: (program: { id: string; name: string }) => {
      programState.currentProgram = program;
      programState.needsProgramSelection = false;
    },
    refreshPrograms: jest.fn(),
  }),
}));

function Destination() {
  const location = useLocation();
  return <div>landed:{location.pathname}{location.search}</div>;
}

const renderAt = (initialPath: string) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/select-program"
          element={<ProtectedRoute><ProgramSelectorPage /></ProtectedRoute>}
        />
        <Route path="/" element={<ProtectedRoute><Destination /></ProtectedRoute>} />
        <Route path="/login" element={<Destination />} />
        <Route
          path="/table-assignments"
          element={<ProtectedRoute><Destination /></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>
  );

describe('program-selection redirect', () => {
  beforeEach(() => {
    authState.user = { email: 'user@example.com' };
    programState.currentProgram = null;
    programState.needsProgramSelection = true;
  });

  test('returns the user to the link they opened, query string included', async () => {
    renderAt('/table-assignments?program=program-b&version=v2');

    // ProtectedRoute bounced us to the picker rather than rendering the page.
    expect(await screen.findByText('Select Your Program')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Program A' }));

    expect(
      await screen.findByText('landed:/table-assignments?program=program-b&version=v2')
    ).toBeInTheDocument();
  });

  test('falls back to home when the picker was opened directly', async () => {
    renderAt('/select-program');

    await userEvent.click(screen.getByRole('button', { name: 'Program B' }));

    expect(await screen.findByText('landed:/')).toBeInTheDocument();
  });

  test('login redirect keeps the query string in returnTo', async () => {
    authState.user = null;
    renderAt('/table-assignments?program=program-b');

    expect(
      await screen.findByText(
        'landed:/login?returnTo=' + encodeURIComponent('/table-assignments?program=program-b')
      )
    ).toBeInTheDocument();
  });
});
