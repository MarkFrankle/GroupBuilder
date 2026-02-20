import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from "@/components/ui/card"
import { Users, LayoutGrid, HelpCircle } from 'lucide-react'

const LandingPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto mt-16 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Group Builder</h1>
          <p className="text-muted-foreground mt-2">
            Create balanced and diverse groups for your seminar series
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Link to="/roster">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <h3 className="font-semibold">Roster</h3>
                <p className="text-sm text-muted-foreground">Add and edit participants</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/groups">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 text-center">
                <LayoutGrid className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <h3 className="font-semibold">Groups</h3>
                <p className="text-sm text-muted-foreground">Generate and view assignments</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/help">
            <Card className="hover:bg-accent cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 text-center">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <h3 className="font-semibold">Help</h3>
                <p className="text-sm text-muted-foreground">How to use Group Builder</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LandingPage
