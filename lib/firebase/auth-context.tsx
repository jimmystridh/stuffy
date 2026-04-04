'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth'
import { getFirebaseAuth, googleProvider } from './config'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: () => Promise<UserCredential | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const auth = getFirebaseAuth()
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signIn = async () => {
    const auth = getFirebaseAuth()
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const allowedEmails = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS || '').split(',').map(e => e.trim())
      if (!result.user.email || !allowedEmails.includes(result.user.email)) {
        await firebaseSignOut(auth)
        return null
      }
      return result
    } catch (error) {
      console.error('Sign in error:', error)
      return null
    }
  }

  const signOut = async () => {
    const auth = getFirebaseAuth()
    await fetch('/api/auth/session', { method: 'DELETE' })
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
