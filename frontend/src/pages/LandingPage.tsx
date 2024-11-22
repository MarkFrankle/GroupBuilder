import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LandingPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numTables, setNumTables] = useState<string>("1")
  const [numSessions, setNumSessions] = useState<string>("1")
  const navigate = useNavigate()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0])
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
  
    const formData = new FormData();
    formData.append('file', file);
    formData.append('numTables', numTables);
    formData.append('numSessions', numSessions);
  
    try {
      // Upload file
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
  
      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }
  
      // Generate assignments
      const assignmentsResponse = await fetch('/api/assignments', {
        method: 'POST',
      });
  
      if (!assignmentsResponse.ok) {
        throw new Error('Failed to generate assignments');
      }
  
      const assignments = await assignmentsResponse.json();
  
      // Navigate to the TableAssignmentsPage with assignments
      navigate('/table-assignments', { state: { assignments } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Group Builder</CardTitle>
          <CardDescription className="text-center">
            Create balanced and diverse groups for your seminar series
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="p-6 bg-secondary rounded-lg">
              <h2 className="text-xl font-semibold mb-2">How it works</h2>
              <p className="text-secondary-foreground">
                Upload an Excel file with participant information, and our algorithm will generate 
                balanced table assignments for each session. We consider factors like religion, 
                gender, and partner status to create diverse groups.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload Participant Data</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex space-x-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="num-tables">Number of Tables</Label>
                  <Select value={numTables} onValueChange={setNumTables}>
                    <SelectTrigger id="num-tables">
                      <SelectValue placeholder="Select number of tables" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="num-sessions">Number of Sessions</Label>
                  <Select value={numSessions} onValueChange={setNumSessions}>
                    <SelectTrigger id="num-sessions">
                      <SelectValue placeholder="Select number of sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between items-center">
                <Button type="submit" variant="outline">
                  Generate Assignments
                </Button>
                <Button variant="outline" asChild>
                  <a href="/template.xlsx" download>
                    Download Template
                  </a>
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LandingPage