import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useProgram } from "../contexts/ProgramContext"

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { currentProgram, needsProgramSelection, loading: programLoading, programs } = useProgram();
  const location = useLocation();

  // Wait for both auth and program data to load
  if (authLoading || programLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  // Redirect to login if not authenticated, preserving return URL
  if (!user) {
    // Keep the query string — a shared link's `?program=<id>` lives there.
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} />;
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
    // Carry the attempted location (pathname + search) so the picker can send
    // the user on to the link they actually opened.
    return <Navigate to="/select-program" state={{ from: location }} replace />;
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
