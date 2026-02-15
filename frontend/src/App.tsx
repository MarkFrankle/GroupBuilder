import React from "react"
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { OrganizationProvider, useOrganization } from "./contexts/OrganizationContext"
import LoginPage from "./pages/LoginPage"
import AuthVerifyPage from "./pages/AuthVerifyPage"
import LandingPage from "./pages/LandingPage"
import TableAssignmentsPage from "./pages/TableAssignmentsPage"
import SeatingChartPage from "./pages/SeatingChartPage"
import { RosterPage } from "./pages/RosterPage"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import InviteAcceptPage from "./pages/InviteAcceptPage"
import OrganizationSelectorPage from "./pages/OrganizationSelectorPage"
import RosterPrintPage from "./pages/RosterPrintPage"
import HelpPage from "./pages/HelpPage"
import PreviousGroupsPage from "./pages/PreviousGroupsPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { currentOrg, needsOrgSelection, loading: orgLoading, organizations } = useOrganization();
  const location = useLocation();

  // Wait for both auth and org data to load
  if (authLoading || orgLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Allow admin page access without org membership
  if (organizations.length === 0 && location.pathname !== '/admin') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No Organization Access</h2>
        <p>You are not a member of any organization. Please contact your administrator to receive an invitation.</p>
      </div>
    );
  }
  
  // Admin page doesn't require org selection
  if (location.pathname === '/admin') {
    return <>{children}</>;
  }

  // Redirect to org selector if needed (and not already there)
  if (needsOrgSelection && location.pathname !== '/select-organization') {
    return <Navigate to="/select-organization" />;
  }

  // Don't require org selection for the selector page itself
  if (location.pathname === '/select-organization') {
    return <>{children}</>;
  }

  // Ensure org is selected before accessing protected routes
  if (!currentOrg) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading organization...</div>;
  }

  return <>{children}</>;
}

function NavBar() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <nav className="no-print border-b px-4 py-2 flex gap-4 text-sm">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">Home</Link>
      <Link to="/roster" className="text-muted-foreground hover:text-foreground transition-colors">Roster</Link>
      <Link to="/groups" className="text-muted-foreground hover:text-foreground transition-colors">Groups</Link>
      <Link to="/help" className="text-muted-foreground hover:text-foreground transition-colors">Help</Link>
    </nav>
  );
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <Router>
          <NavBar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/verify" element={<AuthVerifyPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/help" element={<HelpPage />} />

            <Route
              path="/select-organization"
              element={
                <ProtectedRoute>
                  <OrganizationSelectorPage />
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
      </OrganizationProvider>
    </AuthProvider>
  )
}

export default App