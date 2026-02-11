import React from "react"
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import LoginPage from "./pages/LoginPage"
import AuthVerifyPage from "./pages/AuthVerifyPage"
import LandingPage from "./pages/LandingPage"
import TableAssignmentsPage from "./pages/TableAssignmentsPage"
import SeatingChartPage from "./pages/SeatingChartPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/verify" element={<AuthVerifyPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LandingPage />
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
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App