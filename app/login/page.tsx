'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/firebase/auth-context'
import { getFirebaseAuth } from '@/lib/firebase/config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !loading) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleSignIn = async () => {
    try {
      await signIn()
      // Get ID token and create session
      const idToken = await getFirebaseAuth().currentUser?.getIdToken()
      if (idToken) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        router.push('/')
      }
    } catch (error) {
      console.error('Login failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
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
          <Button onClick={handleSignIn} className="w-full" size="lg">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
