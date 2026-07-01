'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TestTube2, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ConnectConfig {
  id: string
  api_url: string | null
  api_key_hint: string | null
  is_enabled: boolean
  last_sync_at: string | null
  sync_status: 'idle' | 'syncing' | 'error' | null
  error_message: string | null
}

interface Props {
  config: ConnectConfig | null
  isConfigured: boolean
}

export function ConnectClientSection({ config, isConfigured }: Props) {
  const router = useRouter()
  const [apiUrl, setApiUrl] = useState(config?.api_url ?? '')
  const [apiKey, setApiKey] = useState('')   // Never prefill the real key
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  async function handleSave() {
    if (!apiUrl) { setSaveError('API URL is required'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/admin/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_url: apiUrl, api_key: apiKey || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      router.refresh()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error saving config')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/connect/test', { method: 'POST' })
      const json = await res.json()
      setTestResult({ ok: res.ok, message: json.message ?? (res.ok ? 'Connection successful' : 'Connection failed') })
    } catch {
      setTestResult({ ok: false, message: 'Network error during test' })
    } finally {
      setTesting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/admin/connect/sync', { method: 'POST' })
      const json = await res.json()
      setSyncResult(res.ok ? 'Sync initiated successfully' : (json.error ?? 'Sync failed'))
      router.refresh()
    } catch {
      setSyncResult('Network error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader divider>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {saveError && (
          <p role="alert" className="text-sm text-[var(--color-destructive)]">{saveError}</p>
        )}

        <Input
          label="API URL"
          type="url"
          placeholder="https://api.yourplatform.com/v1"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          hint="The base URL of the Connect API endpoint."
        />

        <Input
          label={`API Key${isConfigured ? ' (leave blank to keep current)' : ''}`}
          type="password"
          placeholder={isConfigured ? '••••••••' : 'sk_live_...'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          hint="Your API key is stored encrypted. Only the last 4 characters are shown."
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <Button onClick={handleSave} loading={saving}>
            <Save size={14} aria-hidden="true" />
            Save Configuration
          </Button>

          <Button
            variant="outline"
            onClick={handleTest}
            loading={testing}
            disabled={!isConfigured}
            title={!isConfigured ? 'Configure the API first' : undefined}
          >
            <TestTube2 size={14} aria-hidden="true" />
            Test Connection
          </Button>

          <Button
            variant="ghost"
            onClick={handleSync}
            loading={syncing}
            disabled={!isConfigured}
            title={!isConfigured ? 'Configure the API first' : undefined}
          >
            <RefreshCw size={14} aria-hidden="true" />
            Sync Now
          </Button>
        </div>

        {testResult && (
          <div
            role="status"
            className={`flex items-center gap-2 rounded-[var(--border-radius)] px-3 py-2 text-sm border ${
              testResult.ok
                ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]'
            }`}
          >
            <Badge variant={testResult.ok ? 'success' : 'destructive'} dot>
              {testResult.ok ? 'OK' : 'Failed'}
            </Badge>
            {testResult.message}
          </div>
        )}

        {syncResult && (
          <p role="status" className="text-sm text-[var(--color-muted-foreground)]">
            {syncResult}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
