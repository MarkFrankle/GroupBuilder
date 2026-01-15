import React from "react"
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import LandingPage from "./pages/LandingPage"
import TableAssignmentsPage from "./pages/TableAssignmentsPage"
import SeatingChartPage from "./pages/SeatingChartPage"

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/table-assignments" element={<TableAssignmentsPage />} />
        <Route path="/table-assignments/seating" element={<SeatingChartPage />} />
      </Routes>
    </Router>
  )
}

export default App