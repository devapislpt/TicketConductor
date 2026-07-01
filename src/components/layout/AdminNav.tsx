'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Package,
  Users,
  BarChart3,
  ScrollText,
  Settings,
  Plug,
  ScanLine,
  LayoutDashboard,
  ChevronRight as ChevronRightIcon,
  ChevronLeft,
  X,
  Menu,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { AppUser, UserRole } from '@/lib/types'
import { UserRoleBadge } from '@/components/ui/badge'

// ─── Nav Sections ──────────────────────────────────────────────────────────
interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles?: UserRole[]
  /** Match only the exact path (no startsWith) */
  exact?: boolean
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'], exact: true },
      { href: '/admin/check-in', label: 'Check-In', icon: ScanLine },
    ],
  },
  {
    title: 'Management',
    items: [
      { href: '/admin/events',       label: 'Events',       icon: CalendarDays, roles: ['admin'] },
      { href: '/admin/ticket-packs', label: 'Ticket Packs', icon: Package,      roles: ['admin'] },
      { href: '/admin/users',        label: 'Users',        icon: Users,        roles: ['admin'] },
    ],
  },
  {
    title: 'Insights',
    items: [
      { href: '/admin/reports', label: 'Reports',    icon: BarChart3,  roles: ['admin'] },
      { href: '/admin/logs',    label: 'Audit Logs', icon: ScrollText, roles: ['admin'] },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/admin/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
      { href: '/admin/connect',  label: 'Connect',  icon: Plug,     roles: ['admin'] },
    ],
  },
]

// ─── Props ─────────────────────────────────────────────────────────────────
interface AdminNavProps {
  user: AppUser
  onSignOut?: () => void
}

// ─── Logo ──────────────────────────────────────────────────────────────────
function AdminLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-1 min-w-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-[var(--border-radius)] bg-[var(--color-primary)] flex items-center justify-center">
        <ShieldCheck size={16} className="text-[var(--color-primary-foreground)]" aria-hidden="true" />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            className="overflow-hidden"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.18 }}
          >
            <span className="font-heading text-[var(--color-primary)] text-sm font-semibold tracking-wider whitespace-nowrap block leading-tight">
              TicketConductor
            </span>
            <span className="text-[10px] text-[var(--color-muted-foreground)] tracking-[0.15em] uppercase whitespace-nowrap block -mt-1">
              Admin
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Nav Item ──────────────────────────────────────────────────────────────
function AdminNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem
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
      {isActive && (
        <motion.div
          layoutId="admin-nav-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-primary)] rounded-r"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
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
            'transition-opacity duration-150 z-[60]'
          )}
          role="tooltip"
        >
          {item.label}
        </div>
      )}
    </Link>
  )
}

// ─── Section ───────────────────────────────────────────────────────────────
function AdminNavSection({
  section,
  pathname,
  collapsed,
  role,
}: {
  section: NavSection
  pathname: string
  collapsed: boolean
  role: UserRole
}) {
  const visibleItems = section.items.filter(
    (item) => !item.roles || item.roles.includes(role)
  )

  if (visibleItems.length === 0) return null

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-[var(--color-muted-foreground)]">
          {section.title}
        </p>
      )}
      {collapsed && <div className="h-3" />}
      {visibleItems.map((item) => (
        <AdminNavItem
          key={item.href}
          item={item}
          isActive={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
          collapsed={collapsed}
        />
      ))}
    </div>
  )
}

// ─── Mobile Drawer ─────────────────────────────────────────────────────────
function MobileDrawer({
  open,
  onClose,
  user,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  user: AppUser
  onSignOut?: () => void
}) {
  const pathname = usePathname()

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            className={cn(
              'fixed left-0 top-0 bottom-0 z-50 w-72',
              'bg-[var(--color-card)] border-r border-[var(--color-border)]',
              'flex flex-col overflow-y-auto',
              'shadow-[var(--shadow-lg)]'
            )}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-[var(--color-border)]">
              <AdminLogo collapsed={false} />
              <button
                onClick={onClose}
                className="p-1.5 rounded text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
                aria-label="Close navigation"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {/* Nav */}
            <div className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
              {NAV_SECTIONS.map((section) => (
                <AdminNavSection
                  key={section.title}
                  section={section}
                  pathname={pathname}
                  collapsed={false}
                  role={user.role}
                />
              ))}
            </div>

            {/* User footer */}
            <div className="border-t border-[var(--color-border)] px-3 py-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/40 flex items-center justify-center font-heading text-sm font-semibold text-[var(--color-primary)]">
                  {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                    {user.full_name ?? 'Admin'}
                  </p>
                  <UserRoleBadge role={user.role} />
                </div>
              </div>
              <button
                onClick={onSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--border-radius)] text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export function AdminNav({ user, onSignOut }: AdminNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <>
      {/* ── Mobile menu button ── */}
      <button
        className={cn(
          'md:hidden fixed top-4 left-4 z-50',
          'w-9 h-9 rounded-[var(--border-radius)]',
          'bg-[var(--color-card)] border border-[var(--color-border)]',
          'flex items-center justify-center',
          'text-[var(--color-foreground)]',
          'shadow-[var(--shadow-sm)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
        )}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* ── Mobile Drawer ── */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        user={user}
        onSignOut={onSignOut}
      />

      {/* ── Desktop Sidebar ── */}
      <motion.nav
        className={cn(
          'hidden md:flex flex-col',
          'fixed top-0 left-0 h-screen',
          'bg-[var(--color-card)] border-r border-[var(--color-border)]',
          'z-40 overflow-hidden'
        )}
        animate={{ width: collapsed ? 64 : 256 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        aria-label="Admin navigation"
      >
        {/* Header: logo + collapse button always together, never clipped */}
        <div className="flex items-center justify-between h-16 px-3 border-b border-[var(--color-border)] flex-shrink-0 overflow-hidden">
          <AdminLogo collapsed={collapsed} />
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-[var(--border-radius)]',
              'flex items-center justify-center',
              'text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed
              ? <ChevronRightIcon size={14} aria-hidden="true" />
              : <ChevronLeft size={14} aria-hidden="true" />
            }
          </button>
        </div>

        {/* Nav sections */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <AdminNavSection
              key={section.title}
              section={section}
              pathname={pathname}
              collapsed={collapsed}
              role={user.role}
            />
          ))}
        </div>

        {/* User + sign out */}
        <div className="border-t border-[var(--color-border)] px-2 py-3 space-y-1">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/40 flex items-center justify-center font-heading text-sm font-semibold text-[var(--color-primary)]">
                {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-foreground)] truncate">
                  {user.full_name ?? 'Admin'}
                </p>
                <UserRoleBadge role={user.role} />
              </div>
            </div>
          )}
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
          </button>
        </div>

      </motion.nav>
    </>
  )
}

export default AdminNav
