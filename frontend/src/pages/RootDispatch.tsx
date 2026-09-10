import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useProgram } from '@/contexts/ProgramContext'
import { useAssignmentSetMetadata } from '@/hooks/queries'
import WelcomePage from './WelcomePage'

function getWelcomeKey(uid: string) {
  return `groupbuilder_welcome_seen_${uid}`
}

/**
 * Bare `/` is redirect-only. A first-time facilitator sees the welcome nudge;
 * everyone else lands on the page that matches their program's state — the
 * roster when there is no plan yet, the assignments overview when there is.
 * Post-login redirects default to `/`, so this is also the post-login dispatch.
 */
const RootDispatch: React.FC = () => {
  const { user } = useAuth()
  const uid = user?.uid ?? ''
  const { currentProgram, loading: programLoading } = useProgram()
  const { data: metadata, isLoading: metadataLoading } = useAssignmentSetMetadata(
    currentProgram?.id ?? null,
  )

  const [showWelcome, setShowWelcome] = useState(() => {
    if (!uid) return false
    return !localStorage.getItem(getWelcomeKey(uid))
  })

  const dismissWelcome = () => {
    if (uid) localStorage.setItem(getWelcomeKey(uid), 'true')
    setShowWelcome(false)
  }

  if (showWelcome) {
    return <WelcomePage onDismiss={dismissWelcome} />
  }

  if (programLoading || metadataLoading) {
    return <div className="p-8 text-center">Loading...</div>
  }

  return <Navigate to={metadata ? '/table-assignments' : '/roster'} replace />
}

export default RootDispatch
