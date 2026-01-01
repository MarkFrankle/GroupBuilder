import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { getRecentUploadIds, saveRecentUpload, removeRecentUpload, type RecentUpload } from '@/utils/recentUploads'
import { fetchWithRetry } from '@/utils/fetchWithRetry'
import { formatISOTimeAgo, formatUnixTimeAgo } from '@/utils/timeFormatting'
import { API_BASE_URL } from '@/config/api'
import {
  SESSION_EXPIRY_MESSAGE,
  RESULTS_EXPIRY_MESSAGE,
  ESTIMATED_SOLVE_TIME_MINUTES,
  MAX_TABLES,
  MAX_SESSIONS
} from '@/constants'

// Constant for new upload selection value
const NEW_UPLOAD_VALUE = "new-upload"

interface ResultVersion {
  version_id: string
  created_at: number
  solve_time?: number
  solution_quality?: string
}

const LandingPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [numTables, setNumTables] = useState<string>("1")
  const [numSessions, setNumSessions] = useState<string>("1")
  const [email, setEmail] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMessage, setLoadingMessage] = useState<string>("")
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([])
  const [selectedRecentUpload, setSelectedRecentUpload] = useState<string>("")
  const [availableVersions, setAvailableVersions] = useState<ResultVersion[]>([])
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false)
  const navigate = useNavigate()

  // Load recent uploads on mount
  useEffect(() => {
    const loadRecentUploads = async () => {
      const sessionIds = getRecentUploadIds()
      const uploads: RecentUpload[] = []

      for (const sessionId of sessionIds) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/assignments/sessions/${sessionId}/metadata`)
          if (response.ok) {
            const metadata = await response.json()
            uploads.push(metadata)
          } else {
            // Session expired, remove from localStorage
            removeRecentUpload(sessionId)
          }
        } catch (err) {
          console.error(`Failed to load metadata for session ${sessionId}:`, err)
          removeRecentUpload(sessionId)
        }
      }

      setRecentUploads(uploads)
    }

    loadRecentUploads()
  }, [])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFile(event.target.files[0])
      setSelectedRecentUpload(NEW_UPLOAD_VALUE) // Clear recent upload selection when new file chosen
    }
  }

  const handleRecentUploadSelect = async (sessionId: string) => {
    setSelectedRecentUpload(sessionId)

    if (sessionId === NEW_UPLOAD_VALUE) {
      // "Upload new file" selected, reset form
      setFile(null)
      setAvailableVersions([])
      return
    }

    // Find the selected upload and populate form
    const upload = recentUploads.find(u => u.session_id === sessionId)
    if (upload) {
      setNumTables(upload.num_tables.toString())
      setNumSessions(upload.num_sessions.toString())
      // Clear file input since we're using an existing session
      setFile(null)

      // Fetch available versions
      if (upload.has_results) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/assignments/results/${sessionId}/versions`)
          if (response.ok) {
            const data = await response.json()
            setAvailableVersions(data.versions || [])
          }
        } catch (err) {
          console.error('Failed to fetch versions:', err)
          setAvailableVersions([])
        }
      } else {
        setAvailableVersions([])
      }
    }
  }

  /**
   * Validate form inputs before submission.
   */
  const validateForm = (): boolean => {
    if (!file && (!selectedRecentUpload || selectedRecentUpload === NEW_UPLOAD_VALUE)) {
      setError('Please select a file to upload or choose a recent upload.');
      return false;
    }
    return true;
  };

  /**
   * Clone an existing session with new parameters.
   */
  const cloneSession = async (sessionId: string): Promise<string> => {
    setLoadingMessage('Updating configuration...');

    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/assignments/sessions/${sessionId}/clone?num_tables=${numTables}&num_sessions=${numSessions}`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to update configuration');
    }

    const data = await response.json();
    const newSessionId = data.session_id;
    saveRecentUpload(newSessionId);
    return newSessionId;
  };

  /**
   * Upload a new file and create a session.
   */
  const uploadNewFile = async (): Promise<string> => {
    setLoadingMessage('Uploading participant data...');

    const formData = new FormData();
    formData.append('file', file!);
    formData.append('numTables', numTables);
    formData.append('numSessions', numSessions);
    if (email) {
      formData.append('email', email);
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/api/upload/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'File upload failed');
    }

    const data = await response.json();
    const sessionId = data.session_id;

    if (!sessionId) {
      throw new Error('No session ID received from server');
    }

    saveRecentUpload(sessionId);
    return sessionId;
  };

  /**
   * Get or create a session ID based on user selection.
   */
  const getSessionId = async (): Promise<string> => {
    if (selectedRecentUpload !== NEW_UPLOAD_VALUE) {
      // Using a recent upload - check if parameters changed
      const selectedUpload = recentUploads.find(u => u.session_id === selectedRecentUpload);

      if (selectedUpload &&
          (selectedUpload.num_tables.toString() !== numTables ||
           selectedUpload.num_sessions.toString() !== numSessions)) {
        // Parameters changed - clone session with new params
        return await cloneSession(selectedRecentUpload);
      } else {
        // Parameters unchanged - use existing session
        return selectedRecentUpload;
      }
    } else {
      // New file upload
      return await uploadNewFile();
    }
  };

  /**
   * Generate assignments for a given session.
   */
  const generateAssignments = async (sessionId: string) => {
    setLoadingMessage(`Generating optimal table assignments... This will take approximately ${ESTIMATED_SOLVE_TIME_MINUTES} minutes.`);

    const response = await fetchWithRetry(`${API_BASE_URL}/api/assignments/?session_id=${sessionId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to generate assignments');
    }

    const assignments = await response.json();
    navigate('/table-assignments', { state: { assignments, sessionId } });
  };

  /**
   * Handle form submission.
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const sessionId = await getSessionId();
      await generateAssignments(sessionId);
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
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">How it works</h2>
                  <p className="text-secondary-foreground mb-3">
                    Upload an Excel file with participant information, and our algorithm will generate
                    balanced table assignments for each session. We consider factors like religion,
                    gender, and partner status to create diverse groups.
                  </p>
                  <Button variant="link" asChild className="px-0 h-auto text-sm">
                    <a href="/template.xlsx" download>
                      Download Template with Sample Data
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {recentUploads.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="recent-uploads">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Recent Uploads
                  </Label>
                  <Select value={selectedRecentUpload} onValueChange={handleRecentUploadSelect}>
                    <SelectTrigger id="recent-uploads">
                      <SelectValue placeholder="Select a previous upload" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_UPLOAD_VALUE}>New upload</SelectItem>
                      {recentUploads.map((upload) => {
                        const timeAgo = formatISOTimeAgo(upload.created_at)
                        return (
                          <SelectItem key={upload.session_id} value={upload.session_id}>
                            {upload.filename} ({upload.num_participants} participants, {upload.num_tables} tables, {upload.num_sessions} sessions) - {timeAgo}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Reuse a recent upload ({SESSION_EXPIRY_MESSAGE})
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="file-upload">Upload Participant Data</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  disabled={selectedRecentUpload !== "" && selectedRecentUpload !== NEW_UPLOAD_VALUE}
                />
                {selectedRecentUpload && selectedRecentUpload !== NEW_UPLOAD_VALUE && (
                  <p className="text-sm text-muted-foreground">
                    Using recent upload. Clear selection above to upload a new file.
                  </p>
                )}
              </div>

              <div className="flex space-x-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="num-tables">Number of Tables</Label>
                  <Select value={numTables} onValueChange={setNumTables}>
                    <SelectTrigger id="num-tables">
                      <SelectValue placeholder="Select number of tables" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(MAX_TABLES)].map((_, i) => (
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
                      {[...Array(MAX_SESSIONS)].map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 p-0 h-auto font-normal text-muted-foreground hover:text-foreground"
                  >
                    {advancedOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <span className="text-sm">Advanced Options</span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Get a link to your results via email ({RESULTS_EXPIRY_MESSAGE})
                  </p>
                </CollapsibleContent>
              </Collapsible>

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

              <div className="flex gap-4">
                <Button type="submit" disabled={loading} variant="outline" className="flex-1">
                  Generate Assignments
                </Button>
                {recentUploads.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={loading || !selectedRecentUpload || selectedRecentUpload === NEW_UPLOAD_VALUE || !recentUploads.find(u => u.session_id === selectedRecentUpload)?.has_results}
                        className="flex-1"
                      >
                        View Previous Results
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64 bg-white dark:bg-slate-950">
                      {availableVersions.length > 0 ? (
                        availableVersions.map((version) => (
                          <DropdownMenuItem
                            key={version.version_id}
                            onClick={() => {
                              navigate(`/table-assignments?session=${selectedRecentUpload}&version=${version.version_id}`)
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{version.version_id}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatUnixTimeAgo(version.created_at)}
                                {version.solve_time && ` • ${version.solve_time.toFixed(2)}s`}
                              </span>
                            </div>
                          </DropdownMenuItem>
                        ))
                      ) : (
                        <DropdownMenuItem disabled>No versions available</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default LandingPage