import React from "react"
import { BrowserRouter as Router, Route, Routes } from "react-router-dom"
import TableAssignmentsPage from "./pages/TableAssignmentsPage"

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/table-assignments" element={<TableAssignmentsPage />} />
        {/* Add other routes here */}
      </Routes>
    </Router>
  )
}

export default App