import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertCircle, Loader2, Clock, Upload, Users } from 'lucide-react'
import { importRoster } from '@/api/roster'
import { getRecentUploadIds, removeRecentUpload, type RecentUpload } from '@/utils/recentUploads'
import { authenticatedFetch } from '@/utils/apiClient'
import { formatISOTimeAgo, formatUnixTimeAgo } from '@/utils/timeFormatting'
import { SESSION_EXPIRY_MESSAGE } from '@/constants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDown } from 'lucide-react'

const NEW_UPLOAD_VALUE = "new-upload"

interface ResultVersion {
  version_id: string
  created_at: number
  solve_time?: number
  solution_quality?: string
}

const LandingPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([])
  const [selectedRecentUpload, setSelectedRecentUpload] = useState<string>("")
  const [availableVersions, setAvailableVersions] = useState<ResultVersion[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Load recent uploads on mount
  useEffect(() => {
    const loadRecentUploads = async () => {
      const sessionIds = getRecentUploadIds()
      const uploads: RecentUpload[] = []

      for (const sessionId of sessionIds) {
        try {
          const response = await authenticatedFetch(`/api/assignments/sessions/${sessionId}/metadata`)
          if (response.ok) {
            const metadata = await response.json()
            uploads.push(metadata)
          } else {
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

  const handleRecentUploadSelect = async (sessionId: string) => {
    setSelectedRecentUpload(sessionId)

    if (sessionId === NEW_UPLOAD_VALUE) {
      setAvailableVersions([])
      return
    }

    const upload = recentUploads.find(u => u.session_id === sessionId)
    if (upload?.has_results) {
      try {
        const response = await authenticatedFetch(`/api/assignments/results/${sessionId}/versions`)
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

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    setImporting(true)

    try {
      await importRoster(file)
      navigate('/roster')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import roster')
    } finally {
      setImporting(false)
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Group Builder</CardTitle>
          <CardDescription className="text-center">
            Create balanced and diverse groups for your seminar series
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Two action cards */}
          <div className="grid grid-cols-2 gap-4">
            <Link to="/roster">
              <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <h3 className="font-semibold">Manage Roster</h3>
                  <p className="text-sm text-muted-foreground">Add and edit participants</p>
                </CardContent>
              </Card>
            </Link>
            <Card
              className="hover:bg-accent cursor-pointer transition-colors h-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="pt-6 text-center">
                {importing ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                )}
                <h3 className="font-semibold">Import from Excel</h3>
                <p className="text-sm text-muted-foreground">Upload a roster file</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImport}
                  data-testid="file-input"
                />
              </CardContent>
            </Card>
          </div>

          {/* Download template link */}
          <div className="text-center">
            <Button variant="link" asChild className="px-0 h-auto text-sm">
              <a href="/template.xlsx" download>
                Download Template with Sample Data
              </a>
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Recent uploads section */}
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
                        {upload.filename} ({upload.num_participants} participants) - {timeAgo}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Reuse a recent upload ({SESSION_EXPIRY_MESSAGE})
              </p>
              {selectedRecentUpload && selectedRecentUpload !== NEW_UPLOAD_VALUE && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!recentUploads.find(u => u.session_id === selectedRecentUpload)?.has_results}
                      className="w-full"
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default LandingPage
