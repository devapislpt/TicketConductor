'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AppUser } from '@/lib/types'
import { UserRoleBadge } from '@/components/ui/badge'

// ─── Nav Items ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/events',      label: 'Events',       icon: CalendarDays    },
  { href: '/my-tickets',  label: 'My Tickets',   icon: Ticket          },
  { href: '/profile',     label: 'Profile',      icon: User            },
]

// ─── Props ─────────────────────────────────────────────────────────────────
interface AppNavProps {
  user: AppUser
  onSignOut?: () => void
}

// ─── Logo ──────────────────────────────────────────────────────────────────
function FallConLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2 px-1">
      {/* Monogram / icon mark */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-heading text-[var(--color-primary-foreground)] text-sm font-bold">
          F
        </span>
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            className="font-heading text-[var(--color-primary)] text-xl font-semibold tracking-widest whitespace-nowrap"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
          >
            FallCon
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Avatar ────────────────────────────────────────────────────────────────
function UserAvatar({ user }: { user: AppUser }) {
  const initials = (user.full_name ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div
      className={cn(
        'flex-shrink-0 w-9 h-9 rounded-full',
        'bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/40',
        'flex items-center justify-center',
        'font-heading text-sm font-semibold text-[var(--color-primary)]'
      )}
      aria-label={`Avatar for ${user.full_name ?? user.email}`}
    >
      {initials}
    </div>
  )
}

// ─── Desktop Nav Item ──────────────────────────────────────────────────────
function DesktopNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: (typeof NAV_ITEMS)[number]
  isActive: boolean
  collapsed: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'relative group flex items-center gap-3 px-3 py-2.5 rounded-[var(--border-radius)]',
        'transition-all duration-[var(--animation-duration)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        isActive
          ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
          : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)]'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="desktop-nav-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-primary)] rounded-r"
        />
      )}

      <Icon size={18} className="flex-shrink-0" aria-hidden="true" />

      <AnimatePresence>
        {!collapsed && (
          <motion.span
            className="text-sm font-medium whitespace-nowrap overflow-hidden"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className={cn(
            'absolute left-full ml-2 px-2 py-1',
            'bg-[var(--color-card)] border border-[var(--color-border)]',
            'rounded text-xs text-[var(--color-foreground)] whitespace-nowrap',
            'shadow-[var(--shadow-md)]',
            'opacity-0 group-hover:opacity-100 pointer-events-none',
            'transition-opacity duration-150 z-50'
          )}
          role="tooltip"
        >
          {item.label}
        </div>
      )}
    </Link>
  )
}

// ─── Mobile Bottom Tab ─────────────────────────────────────────────────────
function MobileTabItem({
  item,
  isActive,
}: {
  item: (typeof NAV_ITEMS)[number]
  isActive: boolean
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'relative flex flex-col items-center gap-1 px-3 py-2 flex-1',
        'transition-colors duration-150',
        'focus-visible:outline-none',
        isActive
          ? 'text-[var(--color-primary)]'
          : 'text-[var(--color-muted-foreground)]'
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
    >
      {isActive && (
        <motion.div
          layoutId="mobile-tab-indicator"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[var(--color-primary)] rounded-b"
        />
      )}
      <Icon size={20} aria-hidden="true" />
      <span className="text-[10px] font-medium">{item.label}</span>
    </Link>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export function AppNav({ user, onSignOut }: AppNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <motion.nav
        className={cn(
          'hidden md:flex flex-col',
          'h-screen sticky top-0',
          'bg-[var(--color-card)] border-r border-[var(--color-border)]',
          'transition-all duration-[var(--animation-duration)]',
          'z-40'
        )}
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-3 border-b border-[var(--color-border)]">
          <FallConLogo collapsed={collapsed} />
        </div>

        {/* Nav items */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <DesktopNavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* User section */}
        <div className="border-t border-[var(--color-border)] px-2 py-3 space-y-1">
          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2">
              <UserAvatar user={user} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                  {user.full_name ?? 'User'}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)] truncate">
                  {user.email}
                </p>
                <div className="mt-1">
                  <UserRoleBadge role={user.role} />
                </div>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={onSignOut}
            className={cn(
              'group relative w-full flex items-center gap-3 px-3 py-2.5',
              'rounded-[var(--border-radius)]',
              'text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]',
              'hover:bg-[var(--color-destructive)]/10',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
            aria-label="Sign out"
          >
            <LogOut size={18} className="flex-shrink-0" aria-hidden="true" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  Sign out
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <div
                className={cn(
                  'absolute left-full ml-2 px-2 py-1',
                  'bg-[var(--color-card)] border border-[var(--color-border)]',
                  'rounded text-xs text-[var(--color-foreground)] whitespace-nowrap',
                  'shadow-[var(--shadow-md)]',
                  'opacity-0 group-hover:opacity-100 pointer-events-none',
                  'transition-opacity duration-150 z-50'
                )}
                role="tooltip"
              >
                Sign out
              </div>
            )}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'absolute -right-3 top-20',
            'w-6 h-6 rounded-full',
            'bg-[var(--color-card)] border border-[var(--color-border)]',
            'flex items-center justify-center',
            'text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)]',
            'hover:border-[var(--color-primary)]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
            'z-50'
          )}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed
            ? <ChevronRight size={12} aria-hidden="true" />
            : <ChevronLeft size={12} aria-hidden="true" />
          }
        </button>
      </motion.nav>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav
        className={cn(
          'md:hidden fixed bottom-0 inset-x-0 z-40',
          'bg-[var(--color-card)] border-t border-[var(--color-border)]',
          'flex items-center',
          'safe-area-pb', // respects iOS home bar
          'pb-safe'
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => (
          <MobileTabItem
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>
    </>
  )
}

export default AppNav
