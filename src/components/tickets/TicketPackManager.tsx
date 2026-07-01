'use client'

import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Papa from 'papaparse'
import {
  UserCheck,
  UserX,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  Pencil,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge, TicketStatusBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils/cn'
import type { TicketPack, AppEvent, Ticket, AppUser } from '@/lib/types'

// ─── Zod schema ──────────────────────────────────────────────────────────────
const assignSchema = z.object({
  recipient_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name is too long'),
  recipient_email: z
    .string()
    .email('Please enter a valid email address')
    .max(255, 'Email is too long'),
})

type AssignFormData = z.infer<typeof assignSchema>

// ─── CSV row type ─────────────────────────────────────────────────────────────
interface CsvRow {
  name?: string
  recipient_name?: string
  email?: string
  recipient_email?: string
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TicketPackManagerProps {
  pack: TicketPack & { tickets: Ticket[] }
  event: AppEvent
  isCutoffPassed: boolean
  currentUser: AppUser
}

// ─── Stagger variants ─────────────────────────────────────────────────────────
const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 320, damping: 26 },
  },
}

// ─── TicketCard ───────────────────────────────────────────────────────────────
interface TicketCardProps {
  ticket: Ticket
  index: number
  readOnly: boolean
  onEdit: (ticket: Ticket) => void
  onDelete: (ticket: Ticket) => void
}

function TicketCard({ ticket, index, readOnly, onEdit, onDelete }: TicketCardProps) {
  const isAssigned = ticket.status !== 'unassigned'

  return (
    <motion.div variants={cardVariants}>
      <Card
        variant={isAssigned ? 'default' : 'default'}
        className={cn(
          'group relative transition-all duration-200 h-full',
          !isAssigned && 'border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)]/60',
          isAssigned && 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40',
          ticket.status === 'checked_in' && 'border-[var(--color-success)]/40 bg-[var(--color-success)]/5',
          readOnly && 'opacity-80',
        )}
      >
        <CardContent className="p-4 flex flex-col gap-3 h-full">
          {/* Ticket number + status */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[var(--color-muted-foreground)] tracking-wider">
              #{String(index + 1).padStart(2, '0')}
            </span>
            <TicketStatusBadge status={ticket.status} />
          </div>

          {/* Recipient info */}
          <div className="flex-1">
            {isAssigned ? (
              <div className="space-y-0.5">
                <p className="font-body font-medium text-[var(--color-foreground)] text-sm leading-snug">
                  {ticket.recipient_name}
                </p>
                <p className="font-body text-xs text-[var(--color-muted-foreground)] truncate">
                  {ticket.recipient_email}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-2 gap-1 text-[var(--color-muted-foreground)]">
                <UserX size={20} aria-hidden="true" />
                <span className="text-xs font-body">Unassigned</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {!readOnly && (
            <div className={cn(
              'flex gap-2',
              isAssigned ? 'justify-between' : 'justify-center',
            )}>
              {isAssigned ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(ticket)}
                    aria-label={`Edit ticket ${index + 1} assigned to ${ticket.recipient_name}`}
                    className="flex-1 text-xs"
                  >
                    <Pencil size={13} aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(ticket)}
                    aria-label={`Remove assignment for ticket ${index + 1}`}
                    className="text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(ticket)}
                  aria-label={`Assign ticket ${index + 1}`}
                  className="w-full text-xs"
                >
                  <UserCheck size={13} aria-hidden="true" />
                  Assign Ticket
                </Button>
              )}
            </div>
          )}

          {/* Read-only icon */}
          {readOnly && isAssigned && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <CheckCircle2 size={12} className="text-[var(--color-success)]" aria-hidden="true" />
              <span>Confirmed</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function TicketPackManager({
  pack,
  event,
  isCutoffPassed,
  currentUser,
}: TicketPackManagerProps) {
  const [tickets, setTickets] = useState<Ticket[]>(pack.tickets ?? [])
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null)
  const [deleteTargetTicket, setDeleteTargetTicket] = useState<Ticket | null>(null)
  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvError, setCsvError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const csvTextareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Stats ────────────────────────────────────────────────────────────────
  const assigned = tickets.filter(t => t.status !== 'unassigned').length
  const total = tickets.length
  const pct = total > 0 ? Math.round((assigned / total) * 100) : 0

  // ── Form ─────────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignFormData>({
    resolver: zodResolver(assignSchema),
    defaultValues: { recipient_name: '', recipient_email: '' },
  })

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = useCallback((ticket: Ticket) => {
    setEditingTicket(ticket)
    reset({
      recipient_name: ticket.recipient_name ?? '',
      recipient_email: ticket.recipient_email ?? '',
    })
  }, [reset])

  // ── Close edit modal ──────────────────────────────────────────────────────
  const closeEdit = useCallback(() => {
    setEditingTicket(null)
    reset({ recipient_name: '', recipient_email: '' })
  }, [reset])

  // ── Save assignment (PUT /api/tickets/[ticketId]) ─────────────────────────
  const onSave = useCallback(async (data: AssignFormData) => {
    if (!editingTicket) return
    setIsSaving(true)

    // Optimistic update
    const prev = tickets.find(t => t.id === editingTicket.id)
    setTickets(curr =>
      curr.map(t =>
        t.id === editingTicket.id
          ? {
              ...t,
              recipient_name: data.recipient_name,
              recipient_email: data.recipient_email,
              status: 'assigned',
            }
          : t
      )
    )
    closeEdit()

    try {
      const res = await fetch(`/api/tickets/${editingTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: data.recipient_name,
          recipient_email: data.recipient_email,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Server error ${res.status}`)
      }

      const { ticket: updated } = await res.json()
      setTickets(curr =>
        curr.map(t => (t.id === updated.id ? updated : t))
      )
      toast.success(`Ticket assigned to ${data.recipient_name}`)
    } catch (err) {
      // Revert optimistic update
      if (prev) {
        setTickets(curr =>
          curr.map(t => (t.id === editingTicket.id ? prev : t))
        )
      }
      toast.error((err as Error).message ?? 'Failed to save ticket')
    } finally {
      setIsSaving(false)
    }
  }, [editingTicket, tickets, closeEdit])

  // ── Delete assignment ─────────────────────────────────────────────────────
  const onDelete = useCallback(async () => {
    if (!deleteTargetTicket) return
    setIsDeleting(true)

    const prev = deleteTargetTicket
    setTickets(curr =>
      curr.map(t =>
        t.id === deleteTargetTicket.id
          ? { ...t, recipient_name: null, recipient_email: null, status: 'unassigned' }
          : t
      )
    )
    setDeleteTargetTicket(null)

    try {
      const res = await fetch(`/api/tickets/${deleteTargetTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_name: null, recipient_email: null }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `Server error ${res.status}`)
      }

      toast.success('Ticket assignment removed')
    } catch (err) {
      // Revert
      setTickets(curr =>
        curr.map(t => (t.id === prev.id ? prev : t))
      )
      toast.error((err as Error).message ?? 'Failed to remove assignment')
    } finally {
      setIsDeleting(false)
    }
  }, [deleteTargetTicket])

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const rows = tickets.map((t, i) => ({
      '#': i + 1,
      Name: t.recipient_name ?? '',
      Email: t.recipient_email ?? '',
      Status: t.status,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pack.pack_name.replace(/\s+/g, '_')}_tickets.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.info('CSV exported successfully')
  }, [tickets, pack.pack_name])

  // ── Import CSV ────────────────────────────────────────────────────────────
  const importCsv = useCallback(async () => {
    setCsvError(null)
    if (!csvText.trim()) {
      setCsvError('Please paste CSV content above.')
      return
    }

    const result = Papa.parse<CsvRow>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
    })

    if (result.errors.length) {
      setCsvError(`CSV parse error: ${result.errors[0].message}`)
      return
    }

    const rows = result.data
    if (rows.length === 0) {
      setCsvError('No rows found in CSV.')
      return
    }
    if (rows.length > tickets.length) {
      setCsvError(
        `CSV has ${rows.length} rows but pack only has ${tickets.length} tickets.`
      )
      return
    }

    setIsImporting(true)
    const unassignedTickets = tickets.filter(t => t.status === 'unassigned')
    const targets = unassignedTickets.slice(0, rows.length)

    // Optimistic
    const updates: Ticket[] = []
    setTickets(curr => {
      const next = [...curr]
      rows.forEach((row, i) => {
        const target = targets[i]
        if (!target) return
        const name = (row.recipient_name ?? row.name ?? '').trim()
        const email = (row.recipient_email ?? row.email ?? '').trim()
        const idx = next.findIndex(t => t.id === target.id)
        if (idx !== -1) {
          next[idx] = {
            ...next[idx],
            recipient_name: name || null,
            recipient_email: email || null,
            status: name && email ? 'assigned' : 'unassigned',
          }
          updates.push(next[idx])
        }
      })
      return next
    })

    setCsvModalOpen(false)
    setCsvText('')

    // Fire API calls
    const results = await Promise.allSettled(
      targets.map(async (target, i) => {
        const row = rows[i]
        const name = (row.recipient_name ?? row.name ?? '').trim()
        const email = (row.recipient_email ?? row.email ?? '').trim()
        const res = await fetch(`/api/tickets/${target.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient_name: name || null, recipient_email: email || null }),
        })
        if (!res.ok) throw new Error(`Ticket ${target.id} failed`)
        const { ticket: updated } = await res.json()
        return updated as Ticket
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    // Merge server responses
    setTickets(curr => {
      const next = [...curr]
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          const updated = r.value as Ticket
          const idx = next.findIndex(t => t.id === updated.id)
          if (idx !== -1) next[idx] = updated
        }
      })
      return next
    })

    if (failed > 0) {
      toast.error(`${failed} ticket(s) failed to import. ${succeeded} succeeded.`)
    } else {
      toast.success(`${succeeded} ticket(s) imported from CSV`)
    }

    setIsImporting(false)
  }, [csvText, tickets])

  // ── Refresh tickets ───────────────────────────────────────────────────────
  const refreshTickets = useCallback(async () => {
    try {
      const res = await fetch(`/api/ticket-packs/${pack.id}/tickets`)
      if (!res.ok) return
      const { tickets: fresh } = await res.json()
      setTickets(fresh as Ticket[])
    } catch {
      // silently ignore
    }
  }, [pack.id])

  return (
    <div className="space-y-6">
      {/* ── Cutoff Banner ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isCutoffPassed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            role="alert"
            className="flex items-start gap-3 p-4 rounded-[var(--border-radius)] border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10"
          >
            <AlertTriangle
              size={18}
              className="text-[var(--color-destructive)] flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-body font-semibold text-[var(--color-destructive)]">
                Ticket editing is closed
              </p>
              <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                The assignment deadline has passed. These ticket assignments are now final and read-only.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress + Actions Bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Progress */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-sm font-body">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
              <span className="text-[var(--color-foreground)] font-medium">
                {assigned} of {total} assigned
              </span>
            </div>
            <span className="text-[var(--color-muted-foreground)] text-xs">{pct}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${assigned} of ${total} tickets assigned`}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${pct}%`,
                backgroundColor:
                  assigned === total
                    ? 'var(--color-success)'
                    : 'var(--color-primary)',
              }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Bulk action buttons */}
        {!isCutoffPassed && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCsvModalOpen(true)}
              aria-label="Import assignments from CSV"
            >
              <Upload size={14} aria-hidden="true" />
              Import CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={exportCsv}
              aria-label="Export ticket list as CSV"
            >
              <Download size={14} aria-hidden="true" />
              Export
            </Button>
          </div>
        )}
        {isCutoffPassed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            aria-label="Export ticket list as CSV"
          >
            <Download size={14} aria-hidden="true" />
            Export
          </Button>
        )}
      </div>

      {/* ── Ticket Grid ─────────────────────────────────────────────────── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
        aria-label="Ticket list"
      >
        {tickets.map((ticket, i) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            index={i}
            readOnly={isCutoffPassed || ticket.status === 'checked_in'}
            onEdit={openEdit}
            onDelete={(t) => setDeleteTargetTicket(t)}
          />
        ))}
      </motion.div>

      {/* ── Assign / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        open={editingTicket !== null}
        onOpenChange={(open) => { if (!open) closeEdit() }}
        title={
          editingTicket?.status === 'unassigned'
            ? `Assign Ticket #${tickets.findIndex(t => t.id === editingTicket?.id) + 1}`
            : `Edit Ticket #${tickets.findIndex(t => t.id === editingTicket?.id) + 1}`
        }
        description="Enter the recipient's name and email address. A confirmation email will be sent."
        size="max-w-md"
      >
        <form
          onSubmit={handleSubmit(onSave)}
          noValidate
          className="space-y-4"
          aria-label="Ticket assignment form"
        >
          <Input
            label="Full Name"
            placeholder="Jane Smith"
            required
            error={errors.recipient_name?.message}
            {...register('recipient_name')}
            autoComplete="name"
            autoFocus
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="jane@example.com"
            required
            error={errors.recipient_email?.message}
            {...register('recipient_email')}
            autoComplete="email"
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={closeEdit}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="md"
              loading={isSaving}
            >
              <UserCheck size={15} aria-hidden="true" />
              {editingTicket?.status === 'unassigned' ? 'Assign Ticket' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Modal ────────────────────────────────────── */}
      <Modal
        open={deleteTargetTicket !== null}
        onOpenChange={(open) => { if (!open) setDeleteTargetTicket(null) }}
        title="Remove Assignment"
        description={
          deleteTargetTicket
            ? `Remove the assignment for ${deleteTargetTicket.recipient_name ?? 'this ticket'}? This cannot be undone unless you re-assign it manually.`
            : undefined
        }
        size="max-w-sm"
      >
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setDeleteTargetTicket(null)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            loading={isDeleting}
            onClick={onDelete}
          >
            <Trash2 size={15} aria-hidden="true" />
            Remove
          </Button>
        </div>
      </Modal>

      {/* ── CSV Import Modal ─────────────────────────────────────────────── */}
      <Modal
        open={csvModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCsvModalOpen(false)
            setCsvText('')
            setCsvError(null)
          }
        }}
        title="Import from CSV"
        description={`Paste CSV with columns: name (or recipient_name), email (or recipient_email). Rows will fill unassigned tickets in order. Max ${tickets.filter(t => t.status === 'unassigned').length} rows.`}
        size="max-w-lg"
      >
        <div className="space-y-4">
          {/* Example hint */}
          <div className="rounded-[var(--border-radius)] bg-[var(--color-muted)] p-3 border border-[var(--color-border)]">
            <p className="text-xs font-mono text-[var(--color-muted-foreground)]">
              name,email<br />
              Jane Smith,jane@example.com<br />
              John Doe,john@example.com
            </p>
          </div>

          {/* Textarea */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="csv-paste"
              className="text-sm font-medium font-body text-[var(--color-foreground)]"
            >
              CSV Content
            </label>
            <textarea
              id="csv-paste"
              ref={csvTextareaRef}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setCsvError(null) }}
              placeholder="Paste your CSV here..."
              rows={8}
              className={cn(
                'w-full rounded-[var(--border-radius)] bg-[var(--color-card)]',
                'border font-mono text-xs text-[var(--color-foreground)]',
                'placeholder:text-[var(--color-muted-foreground)]',
                'p-3 resize-y',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]',
                'transition-colors duration-150',
                csvError
                  ? 'border-[var(--color-destructive)]'
                  : 'border-[var(--color-border)]',
              )}
              aria-label="CSV content to import"
              aria-describedby={csvError ? 'csv-error' : undefined}
              aria-invalid={!!csvError}
            />
            {csvError && (
              <p
                id="csv-error"
                role="alert"
                className="text-xs text-[var(--color-destructive)] flex items-center gap-1"
              >
                <X size={12} aria-hidden="true" />
                {csvError}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => { setCsvModalOpen(false); setCsvText(''); setCsvError(null) }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="md"
              loading={isImporting}
              onClick={importCsv}
            >
              <Upload size={15} aria-hidden="true" />
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
