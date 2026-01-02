/**
 * Error Boundary component to catch JavaScript errors anywhere in the React component tree.
 * Prevents the entire app from crashing when an error occurs.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('Error caught by ErrorBoundary:', error, errorInfo)

    // Update state with error info
    this.setState({
      error,
      errorInfo
    })

    // You can also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-2xl">Something went wrong</CardTitle>
                  <CardDescription>
                    The application encountered an unexpected error
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && (
                <>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error Details</AlertTitle>
                    <AlertDescription className="mt-2">
                      <div className="font-mono text-sm">
                        {this.state.error?.toString()}
                      </div>
                    </AlertDescription>
                  </Alert>

                  {this.state.errorInfo && (
                    <details className="bg-gray-100 p-4 rounded-lg">
                      <summary className="cursor-pointer font-semibold text-sm mb-2">
                        Stack Trace (Development Only)
                      </summary>
                      <pre className="text-xs overflow-auto max-h-64 text-gray-700">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </>
              )}

              {process.env.NODE_ENV !== 'development' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button onClick={this.handleReset} variant="outline">
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  Reload Page
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                If this problem persists, please contact support with the error details above.
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
