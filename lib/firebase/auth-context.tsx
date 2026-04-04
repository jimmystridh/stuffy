'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider } from './config'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()

    // Handle redirect result when returning from Google sign-in
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const allowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '').split(',').map(e => e.trim())
        if (!result.user.email || !allowedEmails.includes(result.user.email)) {
          await firebaseSignOut(auth)
          return
        }
        // Create session cookie
        const idToken = await result.user.getIdToken()
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        window.location.href = '/'
      }
    }).catch(console.error)

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async () => {
    const auth = getFirebaseAuth()
    await signInWithRedirect(auth, googleProvider)
  }

  const signOut = async () => {
    const auth = getFirebaseAuth()
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
