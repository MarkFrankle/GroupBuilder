import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HelpCircle, ArrowRight } from 'lucide-react'

interface WelcomePageProps {
  onDismiss: () => void
}

const WelcomePage: React.FC<WelcomePageProps> = ({ onDismiss }) => {
  const navigate = useNavigate()

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto mt-16 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">Welcome to Group Builder</h1>
          <p className="text-muted-foreground text-lg">
            Group Builder helps you create balanced, diverse groups for your seminar series.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-2">
            <CardContent className="pt-6 text-center space-y-4">
              <HelpCircle className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">New here?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Learn how to upload your roster and generate groups.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onDismiss()
                  navigate('/help')
                }}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Learn how it works
              </Button>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="pt-6 text-center space-y-4">
              <ArrowRight className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">Ready to go?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Jump straight in and start building your roster.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onDismiss()
                  navigate('/roster')
                }}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Get started
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default WelcomePage
