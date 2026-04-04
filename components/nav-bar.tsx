'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, MapPin, Menu, X, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/firebase/auth-context'

export function NavBar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const { user, signOut } = useAuth()

  if (pathname === '/login') return null

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/quick-add', label: 'Quick Add', icon: Camera },
    { href: '/locations', label: 'Locations', icon: MapPin },
  ]

  const handleSignOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 py-2 px-4 md:top-0 md:bottom-auto z-50">
      <div className="container mx-auto">
        <button
          className="md:hidden absolute right-4 top-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>

        <div className={cn(
          "flex flex-col md:flex-row items-center justify-center gap-4",
          isOpen ? "block" : "hidden md:flex"
        )}>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button
                variant={pathname === href ? "default" : "ghost"}
                className="w-full md:w-auto flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
          {user && (
            <Button variant="ghost" onClick={handleSignOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </nav>
  )
}
