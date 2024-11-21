import React, { useState } from "react"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table"


interface TableAssignment {
  session: number
  tables: {
    [tableNumber: number]: string[]
  }
}

interface TableAssignmentsProps {
  assignments: TableAssignment[]
}

const TableAssignments: React.FC<TableAssignmentsProps> = ({ assignments }) => {
  const [currentSession, setCurrentSession] = useState(0)

  const nextSession = () => {
    setCurrentSession((prev) => Math.min(prev + 1, assignments.length - 1))
  }

  const prevSession = () => {
    setCurrentSession((prev) => Math.max(prev - 1, 0))
  }

  if (assignments.length === 0) {
    return <div>No assignments available.</div>
  }

  const currentAssignment = assignments[currentSession]

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Seminar Table Assignments</CardTitle>
        <CardDescription>Session {currentAssignment.session}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Participants</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(currentAssignment.tables).map(([tableNumber, participants]) => (
              <TableRow key={tableNumber}>
                <TableCell className="font-medium">Table {tableNumber}</TableCell>
                <TableCell>{participants.join(", ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={prevSession} disabled={currentSession === 0}>
          Previous Session
        </Button>
        <Button onClick={nextSession} disabled={currentSession === assignments.length - 1}>
          Next Session
        </Button>
      </CardFooter>
    </Card>
  )
}

export default TableAssignments