'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/firebase/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [settingUpSession, setSettingUpSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sessionCreated = useRef(false)

  useEffect(() => {
    if (!user || loading || sessionCreated.current) return
    sessionCreated.current = true
    setSettingUpSession(true)

    user.getIdToken().then(async (idToken) => {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (res.ok) {
        window.location.href = '/'
      } else {
        setError('Session creation failed. You may not be authorized.')
        setSettingUpSession(false)
        sessionCreated.current = false
      }
    }).catch((err) => {
      console.error('Session error:', err)
      setError('Failed to create session')
      setSettingUpSession(false)
      sessionCreated.current = false
    })
  }, [user, loading])

  const handleSignIn = async () => {
    setSigningIn(true)
    setError(null)
    // signInWithPopup may not resolve due to COOP issues
    // but onAuthStateChanged will still fire when auth succeeds
    // So we fire and forget — the useEffect above handles the rest
    signIn().then((result) => {
      if (!result) {
        setSigningIn(false)
        setError('Sign-in cancelled or unauthorized.')
      }
    }).catch(() => {
      // Popup was blocked or COOP issue — auth may still succeed via onAuthStateChanged
      console.log('Popup promise rejected, waiting for auth state change...')
    })
  }

  if (loading || settingUpSession) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{settingUpSession ? 'Setting up session...' : 'Loading...'}</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Stuffy</CardTitle>
          <p className="text-center text-muted-foreground">Personal Inventory Tracker</p>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-sm text-red-500 mb-4 text-center">{error}</p>
          )}
          <Button onClick={handleSignIn} disabled={signingIn} className="w-full" size="lg">
            {signingIn ? 'Waiting for Google sign-in...' : 'Sign in with Google'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
