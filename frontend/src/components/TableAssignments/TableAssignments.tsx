import React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface Participant {
  name: string;
  religion: string;
  gender: string;
  partner: string | null;
}

interface Assignment {
  session: number;
  tables: {
    [key: number]: Participant[];
  };
}

interface TableAssignmentsProps {
  assignment: Assignment;
}

const TableAssignments: React.FC<TableAssignmentsProps> = ({ assignment }) => {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Session {assignment.session}</h2>
      {Object.entries(assignment.tables).map(([tableNumber, participants]) => (
        <div key={tableNumber} className="mb-8">
          <h3 className="text-xl font-semibold mb-2">Table {tableNumber}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Religion</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Partner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant, index) => (
                <TableRow key={index}>
                  <TableCell>{participant.name}</TableCell>
                  <TableCell>{participant.religion}</TableCell>
                  <TableCell>{participant.gender}</TableCell>
                  <TableCell>{participant.partner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

export default TableAssignments