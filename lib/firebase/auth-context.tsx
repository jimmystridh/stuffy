'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
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
        throw new Error('Unauthorized email address')
      }
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
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
