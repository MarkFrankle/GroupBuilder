import React from "react"
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link } from "react-router-dom"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { useIsAdmin } from "./hooks/queries"
import { ProgramProvider, useProgram } from "./contexts/ProgramContext"
import LoginPage from "./pages/LoginPage"
import AuthVerifyPage from "./pages/AuthVerifyPage"
import LandingPage from "./pages/LandingPage"
import TableAssignmentsPage from "./pages/TableAssignmentsPage"
import SeatingChartPage from "./pages/SeatingChartPage"
import { RosterPage } from "./pages/RosterPage"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import AdminHelpPage from "./pages/admin/AdminHelpPage"
import InviteAcceptPage from "./pages/InviteAcceptPage"
import ProgramSelectorPage from "./pages/ProgramSelectorPage"
import RosterPrintPage from "./pages/RosterPrintPage"
import HelpPage from "./pages/HelpPage"
import LegalPage from "./pages/LegalPage"
import PreviousGroupsPage from "./pages/PreviousGroupsPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { currentProgram, needsProgramSelection, loading: programLoading, programs } = useProgram();
  const location = useLocation();

  // Wait for both auth and program data to load
  if (authLoading || programLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  // Redirect to login if not authenticated, preserving return URL
  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} />;
  }

  // Allow admin page access without program membership
  if (programs.length === 0 && !location.pathname.startsWith('/admin')) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No Program Access</h2>
        <p>You are not a member of any program. Please contact your administrator to receive an invitation.</p>
      </div>
    );
  }

  // Admin pages don't require program selection
  if (location.pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  // Redirect to program selector if needed (and not already there)
  if (needsProgramSelection && location.pathname !== '/select-program') {
    return <Navigate to="/select-program" />;
  }

  // Don't require program selection for the selector page itself
  if (location.pathname === '/select-program') {
    return <>{children}</>;
  }

  // Ensure program is selected before accessing protected routes
  if (!currentProgram) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading program...</div>;
  }

  return <>{children}</>;
}

function NavBar() {
  const { user, signOut } = useAuth();
  const { currentProgram } = useProgram();
  const { data: isAdmin } = useIsAdmin(!!user);
  const location = useLocation();
  if (!user) return null;
  const hasProgram = !!currentProgram;
  const isAdminPage = location.pathname.startsWith('/admin');
  return (
    <nav className="no-print border-b px-4 py-2 flex gap-4 text-sm items-center">
      {(hasProgram || isAdminPage) && <>
        <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
        <Link to="/roster" className="text-muted-foreground hover:text-foreground transition-colors">Roster</Link>
        <Link to="/groups" className="text-muted-foreground hover:text-foreground transition-colors">Groups</Link>
        <Link to="/help" className="text-muted-foreground hover:text-foreground transition-colors">Help</Link>
      </>}
      <div className="ml-auto flex gap-4 items-center">
        {isAdmin && <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">Admin</Link>}
        <span className="text-muted-foreground">{user.email}</span>
        <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground transition-colors">Logout</button>
      </div>
    </nav>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,  // 2 min — data under 2 min old served from cache
      gcTime: 5 * 60 * 1000,     // 5 min — unused cache entries garbage collected
      retry: (failureCount, error) => {
        // Don't retry auth or permission errors — they're not transient
        if (error?.name === 'AuthenticationError') return false;
        if (error instanceof Error && /\b(40[13])\b/.test(error.message)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
})

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ProgramProvider>
        <QueryClientProvider client={queryClient}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <NavBar />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/verify" element={<AuthVerifyPage />} />
              <Route path="/invite/:token" element={<InviteAcceptPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/legal" element={<LegalPage />} />

              <Route
                path="/select-program"
                element={
                  <ProtectedRoute>
                    <ProgramSelectorPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <LandingPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/roster"
                element={
                  <ProtectedRoute>
                    <RosterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/groups"
                element={
                  <ProtectedRoute>
                    <PreviousGroupsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/help"
                element={
                  <ProtectedRoute>
                    <AdminHelpPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/table-assignments"
                element={
                  <ProtectedRoute>
                    <TableAssignmentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/table-assignments/seating"
                element={
                  <ProtectedRoute>
                    <SeatingChartPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/table-assignments/roster-print"
                element={
                  <ProtectedRoute>
                    <RosterPrintPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </ProgramProvider>
    </AuthProvider>
  )
}

export default App
