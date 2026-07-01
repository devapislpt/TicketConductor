'use client'

/**
 * SystemConfigEditor — Admin credentials & system configuration UI.
 *
 * Tabs: General | Email | Connect
 *
 * Behaviour:
 *  - Fetches current config from GET /api/admin/system-config on mount
 *  - Values tracked locally; only saved on explicit Save press
 *  - Secret fields show placeholder dots + last-4 hint if already set
 *  - Eye-toggle to reveal typed value (does NOT fetch actual secret from server)
 *  - Test buttons call POST /api/admin/system-config/test
 *  - Toast feedback on save / test results
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye,
  EyeOff,
  Save,
  Send,
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import type { SystemConfigItem } from '@/app/api/admin/system-config/route'

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabId = 'general' | 'email' | 'connect'

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'email', label: 'Email' },
  { id: 'connect', label: 'Connect' },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

type ServiceStatus = 'configured' | 'partial' | 'unconfigured'

interface StatusBadgeProps {
  status: ServiceStatus
  label: string
}

function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = {
    configured: {
      icon: <CheckCircle2 size={14} />,
      text: 'Configured',
      className: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/25',
    },
    partial: {
      icon: <AlertTriangle size={14} />,
      text: 'Partial',
      className: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
    },
    unconfigured: {
      icon: <XCircle size={14} />,
      text: 'Not configured',
      className: 'text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]/25',
    },
  }[status]

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium', cfg.className)}>
      {cfg.icon}
      <span>{label}: {cfg.text}</span>
    </div>
  )
}

// ─── Secret input ─────────────────────────────────────────────────────────────

interface SecretInputProps {
  label: string
  hint?: string       // description text
  valueHint?: string | null   // last-4 chars if set server-side
  isSet: boolean
  value: string       // local draft value
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}

function SecretInput({
  label,
  hint,
  valueHint,
  isSet,
  value,
  onChange,
  placeholder,
  required,
}: SecretInputProps) {
  const [revealed, setRevealed] = useState(false)

  // Show placeholder only when field is empty (untouched and server says it's set)
  const showSetIndicator = isSet && value === ''
  const displayPlaceholder = showSetIndicator
    ? (valueHint ? `••••••••${valueHint}` : '••••••••  (set — type to replace)')
    : placeholder

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-foreground)]">
          {label}
          {required && <span className="ml-1 text-[var(--color-primary)]" aria-label="required">*</span>}
        </label>
        {isSet && value === '' && (
          <span className="text-xs text-[var(--color-success)] flex items-center gap-1">
            <CheckCircle2 size={12} />
            Set
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={displayPlaceholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full h-10 px-3 py-2 pr-10',
            'bg-[var(--color-card)] text-[var(--color-foreground)]',
            'font-body text-sm rounded-[var(--border-radius)]',
            'border border-[var(--color-border)]',
            'placeholder:text-[var(--color-muted-foreground)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
            'transition-colors duration-150',
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={revealed ? 'Hide value' : 'Show value'}
          onClick={() => setRevealed((v) => !v)}
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
            'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
            'transition-colors duration-150 focus-visible:outline-none',
          )}
        >
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {hint && (
        <p className="text-xs text-[var(--color-muted-foreground)]">{hint}</p>
      )}
    </div>
  )
}

// ─── Inline test result ───────────────────────────────────────────────────────

interface TestResultProps {
  success: boolean | null
  message: string
}

function TestResult({ success, message }: TestResultProps) {
  if (success === null) return null
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={cn(
          'flex items-start gap-2 text-xs px-3 py-2.5 rounded-[var(--border-radius)] border',
          success
            ? 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20'
            : 'text-[var(--color-destructive)] bg-[var(--color-destructive)]/10 border-[var(--color-destructive)]/20'
        )}
      >
        {success ? <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" /> : <XCircle size={14} className="mt-0.5 flex-shrink-0" />}
        <span>{message}</span>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SystemConfigEditor() {
  const [activeTab, setActiveTab] = useState<TabId>('general')
  const [configItems, setConfigItems] = useState<SystemConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Local draft values — key → typed string (empty = unchanged)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<TabId | null>(null)
  const [testing, setTesting] = useState<'email' | 'connect' | null>(null)
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [connectTestResult, setConnectTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // ── Fetch config ────────────────────────────────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/system-config')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to load config')
      if (!json.data) throw new Error('No config data returned')
      setConfigItems(json.data as SystemConfigItem[])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load system configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getItem = (key: string) => configItems.find((c) => c.key === key)

  const draft = (key: string) => drafts[key] ?? ''

  const setDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }))
  }

  // Build save payload for a list of keys
  function buildUpdates(keys: string[]) {
    return keys
      .filter((k) => drafts[k] !== undefined && drafts[k] !== '')
      .map((k) => ({ key: k, value: drafts[k] }))
  }

  async function saveKeys(tab: TabId, keys: string[]) {
    const updates = buildUpdates(keys)
    if (updates.length === 0) {
      toast.info('No changes to save.')
      return
    }

    setSaving(tab)
    try {
      const res = await fetch('/api/admin/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(typeof json.error === 'string' ? json.error : 'Save failed')

      // Clear saved drafts and refresh
      const savedKeys = updates.map((u) => u.key)
      setDrafts((prev) => {
        const next = { ...prev }
        savedKeys.forEach((k) => delete next[k])
        return next
      })
      await fetchConfig()
      toast.success('Settings saved successfully.')
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSaving(null)
    }
  }

  async function runTest(service: 'email' | 'connect') {
    setTesting(service)
    if (service === 'email') setEmailTestResult(null)
    if (service === 'connect') setConnectTestResult(null)

    try {
      const res = await fetch('/api/admin/system-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      })
      const json = await res.json()
      const result = { success: Boolean(json.success), message: json.message ?? 'No message returned' }

      if (service === 'email') setEmailTestResult(result)
      if (service === 'connect') setConnectTestResult(result)

      if (result.success) toast.success(result.message)
      else toast.error(result.message)
    } catch (e) {
      const result = { success: false, message: e instanceof Error ? e.message : 'Request failed' }
      if (service === 'email') setEmailTestResult(result)
      if (service === 'connect') setConnectTestResult(result)
      toast.error(result.message)
    } finally {
      setTesting(null)
    }
  }

  // ── Derived status ──────────────────────────────────────────────────────────

  function emailStatus(): ServiceStatus {
    const keySet = getItem('resend_api_key')?.is_set || draft('resend_api_key') !== ''
    const fromSet = getItem('resend_from_email')?.is_set || draft('resend_from_email') !== ''
    if (keySet && fromSet) return 'configured'
    if (keySet || fromSet) return 'partial'
    return 'unconfigured'
  }

  function connectStatus(): ServiceStatus {
    const urlSet = getItem('connect_api_url')?.is_set || draft('connect_api_url') !== ''
    const keySet = getItem('connect_api_key')?.is_set || draft('connect_api_key') !== ''
    if (urlSet && keySet) return 'configured'
    if (urlSet || keySet) return 'partial'
    return 'unconfigured'
  }

  // ── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-[var(--color-muted-foreground)]">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading system configuration&hellip;</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-3 text-[var(--color-destructive)]">
            <XCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Failed to load configuration</p>
              <p className="text-xs mt-1 text-[var(--color-muted-foreground)]">{loadError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fetchConfig}
                silent
              >
                <RefreshCw size={13} className="mr-1.5" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150',
              'focus-visible:outline-none focus-visible:text-[var(--color-primary)]',
              activeTab === tab.id
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── General tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <motion.div
          key="general"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >
          <div className="space-y-4">
            <Input
              label="App Name"
              value={draft('app_name') || (getItem('app_name')?.value_hint ?? '')}
              onChange={(e) => setDraft('app_name', e.target.value)}
              placeholder="FallCon Ticket Conductor"
              hint="Displayed in the UI and outgoing emails."
            />
            <Input
              label="App URL"
              type="url"
              value={draft('app_url') || (getItem('app_url')?.value_hint ?? '')}
              onChange={(e) => setDraft('app_url', e.target.value)}
              placeholder="https://tickets.fallcon.com"
              hint="The canonical public URL of this app (used in email links)."
            />
            <Input
              label="Support Email"
              type="email"
              value={draft('support_email') || (getItem('support_email')?.value_hint ?? '')}
              onChange={(e) => setDraft('support_email', e.target.value)}
              placeholder="support@fallcon.com"
              hint="Shown to attendees who need help."
            />
          </div>

          <Button
            onClick={() => saveKeys('general', ['app_name', 'app_url', 'support_email'])}
            loading={saving === 'general'}
            silent
          >
            <Save size={15} className="mr-2" />
            Save General Settings
          </Button>
        </motion.div>
      )}

      {/* ── Email tab ────────────────────────────────────────────────────────── */}
      {activeTab === 'email' && (
        <motion.div
          key="email"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={emailStatus()} label="Resend" />
          </div>

          <div className="space-y-4">
            <SecretInput
              label="Resend API Key"
              hint="Starts with re_. Obtain from resend.com/api-keys."
              isSet={getItem('resend_api_key')?.is_set ?? false}
              valueHint={getItem('resend_api_key')?.value_hint ?? null}
              value={draft('resend_api_key')}
              onChange={(v) => setDraft('resend_api_key', v)}
              placeholder="re_••••••••••••••••"
              required
            />
            <Input
              label="From Email Address"
              type="email"
              value={draft('resend_from_email') || (getItem('resend_from_email')?.value_hint ?? '')}
              onChange={(e) => setDraft('resend_from_email', e.target.value)}
              placeholder="tickets@fallcon.com"
              hint="Must be a verified Resend domain or email."
              required
            />
            <Input
              label="From Display Name"
              value={draft('resend_from_name') || (getItem('resend_from_name')?.value_hint ?? '')}
              onChange={(e) => setDraft('resend_from_name', e.target.value)}
              placeholder="FallCon Tickets"
              hint="Appears as the from name in recipients' inbox."
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => saveKeys('email', ['resend_api_key', 'resend_from_email', 'resend_from_name'])}
              loading={saving === 'email'}
              silent
            >
              <Save size={15} className="mr-2" />
              Save Email Settings
            </Button>

            <Button
              variant="outline"
              onClick={() => runTest('email')}
              loading={testing === 'email'}
              disabled={
                testing !== null ||
                (!(getItem('resend_api_key')?.is_set) && draft('resend_api_key') === '')
              }
              silent
            >
              <Send size={14} className="mr-2" />
              Send Test Email
            </Button>
          </div>

          {emailTestResult && (
            <TestResult success={emailTestResult.success} message={emailTestResult.message} />
          )}

          <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-xs text-[var(--color-muted-foreground)] flex items-start gap-2">
            <Info size={13} className="flex-shrink-0 mt-0.5 text-[var(--color-primary)]" />
            <span>
              The API key is encrypted at rest using AES-256-GCM. The actual key is never returned to the browser.
              If you need to update it, simply type the new value and save — the old value is overwritten.
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Connect tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'connect' && (
        <motion.div
          key="connect"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={connectStatus()} label="Connect API" />
          </div>

          <div className="space-y-4">
            <Input
              label="Connect API URL"
              type="url"
              value={draft('connect_api_url') || (getItem('connect_api_url')?.value_hint ?? '')}
              onChange={(e) => setDraft('connect_api_url', e.target.value)}
              placeholder="https://api.connect.example.com"
              hint="The base URL of the Connect integration endpoint."
            />
            <SecretInput
              label="Connect API Key"
              hint="Authentication key for the Connect API."
              isSet={getItem('connect_api_key')?.is_set ?? false}
              valueHint={getItem('connect_api_key')?.value_hint ?? null}
              value={draft('connect_api_key')}
              onChange={(v) => setDraft('connect_api_key', v)}
              placeholder="sk_•••••••••••••••••••••••"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => saveKeys('connect', ['connect_api_url', 'connect_api_key'])}
              loading={saving === 'connect'}
              silent
            >
              <Save size={15} className="mr-2" />
              Save Connect Settings
            </Button>

            <Button
              variant="outline"
              onClick={() => runTest('connect')}
              loading={testing === 'connect'}
              disabled={
                testing !== null ||
                (!(getItem('connect_api_url')?.is_set) && draft('connect_api_url') === '')
              }
              silent
            >
              <Plug size={14} className="mr-2" />
              Test Connection
            </Button>
          </div>

          {connectTestResult && (
            <TestResult success={connectTestResult.success} message={connectTestResult.message} />
          )}

          <div className="rounded-[var(--border-radius)] border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-3 text-xs text-[var(--color-muted-foreground)] flex items-start gap-2">
            <Info size={13} className="flex-shrink-0 mt-0.5 text-[var(--color-primary)]" />
            <span>
              <strong className="text-[var(--color-foreground)]">Full Connect integration coming soon.</strong>{' '}
              See <code className="font-mono text-[var(--color-primary)]">docs/connect-integration.md</code> for
              the planned sync architecture, field mappings, and webhook configuration.
            </span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
