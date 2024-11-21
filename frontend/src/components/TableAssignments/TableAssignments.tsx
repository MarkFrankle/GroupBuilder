import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Participant {
  name: string
  religion: string
  gender: string
  partner: string
}

interface TableAssignment {
  session: number
  tables: {
    [tableNumber: number]: Participant[]
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
    return <div className="text-center text-gray-500">No assignments available.</div>
  }

  const currentAssignment = assignments[currentSession]

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <CardHeader className="space-y-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
        <CardDescription className="text-xl font-bold text-gray-200">Session {currentAssignment.session}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Table>
          <TableHeader className="bg-gray-200 dark:bg-gray-700">
            <TableRow>
              <TableHead className="font-bold text-gray-700 dark:text-gray-300">Table</TableHead>
              <TableHead className="font-bold text-gray-700 dark:text-gray-300">Participants</TableHead>
              <TableHead className="font-bold text-gray-700 dark:text-gray-300">Religion</TableHead>
              <TableHead className="font-bold text-gray-700 dark:text-gray-300">Gender</TableHead>
              <TableHead className="font-bold text-gray-700 dark:text-gray-300">Partner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(currentAssignment.tables).map(([tableNumber, participants]) => (
              <TableRow 
                key={tableNumber} 
                className="border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <TableCell className="font-medium text-gray-900 dark:text-gray-100">Table {tableNumber}</TableCell>
                <TableCell className="text-gray-800 dark:text-gray-200">
                  {participants.map((participant, index) => (
                    <div key={index} className="mb-1 last:mb-0">{participant.name}</div>
                  ))}
                </TableCell>
                <TableCell className="text-gray-800 dark:text-gray-200">
                  {participants.map((participant, index) => (
                    <div key={index} className="mb-1 last:mb-0">{participant.religion}</div>
                  ))}
                </TableCell>
                <TableCell className="text-gray-800 dark:text-gray-200">
                  {participants.map((participant, index) => (
                    <div key={index} className="mb-1 last:mb-0">{participant.gender}</div>
                  ))}
                </TableCell>
                <TableCell className="text-gray-800 dark:text-gray-200">
                  {participants.map((participant, index) => (
                    <div key={index} className="mb-1 last:mb-0">{participant.partner}</div>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter className="flex justify-between bg-gray-100 dark:bg-gray-800 rounded-b-lg">
        <Button 
          onClick={prevSession} 
          disabled={currentSession === 0}
          className="bg-blue-500 hover:bg-blue-600 text-white"
        >
          Previous Session
        </Button>
        <Button 
          onClick={nextSession} 
          disabled={currentSession === assignments.length - 1}
          className="bg-purple-500 hover:bg-purple-600 text-white"
        >
          Next Session
        </Button>
      </CardFooter>
    </Card>
  )
}

export default TableAssignments