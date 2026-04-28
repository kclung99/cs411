'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

const showDbAdmin =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_SHOW_DB_ADMIN === 'true'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Users' },
  { href: '/stations', label: 'Stations' },
  { href: '/maintenance', label: 'Routine Ops' },
  ...(showDbAdmin ? [{ href: '/db', label: 'DB Admin' }] : []),
]

function isActive(pathname, href) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DesktopNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-1 flex-col gap-2 p-3">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm text-foreground/90 hover:bg-accent hover:text-accent-foreground',
              active && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-2 overflow-x-auto">
      {navItems.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'shrink-0 rounded-md border px-3 py-2 text-sm hover:bg-accent',
              active && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
