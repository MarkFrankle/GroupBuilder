import { Link } from 'react-router-dom'
import { Button } from "@/components/ui/button"

export default function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center space-y-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">
        That link doesn't go anywhere. It may be out of date, or the address may
        have a typo.
      </p>
      <div className="pt-2">
        <Button variant="outline" asChild>
          <Link to="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  )
}
