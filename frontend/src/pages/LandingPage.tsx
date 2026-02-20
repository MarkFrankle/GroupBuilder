import React from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const LandingPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-md mx-auto mt-16">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Group Builder</CardTitle>
          <CardDescription className="text-center">
            Create balanced and diverse groups for your seminar series
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/roster">Manage Roster</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default LandingPage
