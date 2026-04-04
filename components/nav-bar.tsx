'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Camera, MapPin, ClipboardCheck, Archive, LogOut } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/firebase/auth-context'

export function NavBar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()

  if (pathname === '/login') return null

  const links = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/quick-add', label: 'Quick Add', icon: Camera },
    { href: '/locations', label: 'Locations', icon: MapPin },
    { href: '/stocktaking', label: 'Stocktaking', icon: ClipboardCheck },
    { href: '/removed', label: 'Removed', icon: Archive },
  ]

  const handleSignOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut()
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t dark:border-gray-700 py-1 px-2 md:top-0 md:bottom-auto z-50">
      <div className="container mx-auto flex items-center justify-around md:justify-center md:gap-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}>
              <Button
                variant={active ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "flex flex-col md:flex-row items-center gap-0.5 md:gap-2 h-auto py-1.5 px-2 md:px-3",
                  active ? "" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
                <span className="text-[10px] md:text-sm">{label}</span>
              </Button>
            </Link>
          )
        })}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex flex-col md:flex-row items-center gap-0.5 md:gap-2 h-auto py-1.5 px-2 md:px-3 text-muted-foreground"
          >
            <LogOut className="h-5 w-5 md:h-4 md:w-4" />
            <span className="text-[10px] md:text-sm">Sign Out</span>
          </Button>
        )}
      </div>
    </nav>
  )
}
