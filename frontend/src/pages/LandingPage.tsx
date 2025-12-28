import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const LandingPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numTables, setNumTables] = useState<string>("1")
  const [numSessions, setNumSessions] = useState<string>("1")
  const [email, setEmail] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>("")
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

    setError(null);
    setLoading(true);
    setLoadingMessage('Uploading participant data...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('numTables', numTables);
    formData.append('numSessions', numSessions);
    if (email) {
      formData.append('email', email);
    }

    try {
      // Upload file and get session ID
      const uploadResponse = await fetch(`${API_BASE_URL}/api/upload/`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || 'File upload failed');
      }

      const uploadData = await uploadResponse.json();
      const sessionId = uploadData.session_id;

      if (!sessionId) {
        throw new Error('No session ID received from server');
      }

      // Generate assignments using session ID
      setLoadingMessage('Generating optimal table assignments... This may take up to 2 minutes for large groups.');

      const assignmentsResponse = await fetch(`${API_BASE_URL}/api/assignments/?session_id=${sessionId}`, {
        method: 'GET',
      });

      if (!assignmentsResponse.ok) {
        const errorData = await assignmentsResponse.json();
        throw new Error(errorData.detail || 'Failed to generate assignments');
      }

      const assignments = await assignmentsResponse.json();

      // Navigate to the TableAssignmentsPage with assignments and session ID
      navigate('/table-assignments', { state: { assignments, sessionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setLoadingMessage('');
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

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Get a link to your results via email (bookmarkable for 30 days)
                </p>
              </div>

              {loading && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertTitle>Processing</AlertTitle>
                  <AlertDescription>{loadingMessage}</AlertDescription>
                </Alert>
              )}

              {error && !loading && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between items-center">
                <Button type="submit" variant="outline" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Generate Assignments'
                  )}
                </Button>
                <Button variant="outline" asChild disabled={loading}>
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