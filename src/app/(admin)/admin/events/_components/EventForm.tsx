'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, ExternalLink, Eye, EyeOff, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { slugify, formatDateTime } from '@/lib/utils/format'
import type { AppEvent, EventLink } from '@/lib/types'

// ─── Schema ───────────────────────────────────────────────────────────────────
const linkSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['zoom', 'maps', 'website', 'other']),
  label: z.string().min(1, 'Label required'),
  url: z.string().url('Must be a valid URL'),
  sort_order: z.number().default(0),
})

const eventSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug required').regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, hyphens'),
  description: z.string().optional(),
  details: z.string().optional(),
  location_name: z.string().optional(),
  location_address: z.string().optional(),
  google_maps_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  start_date: z.string().min(1, 'Start date required'),
  end_date: z.string().optional(),
  cutoff_at: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  banner_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  links: z.array(linkSchema).default([]),
})

type EventFormValues = z.infer<typeof eventSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  // Converts "2025-10-15T18:00:00Z" → "2025-10-15T18:00" for datetime-local input
  return iso.slice(0, 16)
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface EventFormProps {
  mode: 'create' | 'edit'
  event?: AppEvent & { links?: EventLink[] }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function EventForm({ mode, event }: EventFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [slugLocked, setSlugLocked] = useState(mode === 'edit')

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event?.name ?? '',
      slug: event?.slug ?? '',
      description: event?.description ?? '',
      details: event?.details ?? '',
      location_name: event?.location_name ?? '',
      location_address: event?.location_address ?? '',
      google_maps_url: event?.google_maps_url ?? '',
      start_date: toDatetimeLocal(event?.start_date),
      end_date: toDatetimeLocal(event?.end_date),
      cutoff_at: toDatetimeLocal(event?.cutoff_at),
      status: event?.status ?? 'draft',
      banner_url: event?.banner_url ?? '',
      links: (event?.links ?? []).map((l) => ({
        id: l.id,
        type: l.type,
        label: l.label,
        url: l.url,
        sort_order: l.sort_order,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'links' })

  const watchedName = watch('name')
  const watchedValues = watch()

  // Auto-slugify on name change when not locked
  useEffect(() => {
    if (!slugLocked && watchedName) {
      setValue('slug', slugify(watchedName), { shouldDirty: true })
    }
  }, [watchedName, slugLocked, setValue])

  async function onSubmit(values: EventFormValues) {
    setServerError(null)
    try {
      const url = mode === 'create' ? '/api/events' : `/api/events/${event!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Ensure empty strings become null for optional fields
          google_maps_url: values.google_maps_url || null,
          banner_url: values.banner_url || null,
          end_date: values.end_date || null,
          cutoff_at: values.cutoff_at || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Request failed')

      router.push('/admin/events')
      router.refresh()
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'An error occurred')
    }
  }

  const linkTypeOptions: Array<{ value: EventLink['type']; label: string }> = [
    { value: 'zoom', label: 'Zoom' },
    { value: 'maps', label: 'Maps' },
    { value: 'website', label: 'Website' },
    { value: 'other', label: 'Other' },
  ]

  const statusOptions: Array<{ value: AppEvent['status']; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'archived', label: 'Archived' },
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* ── Server Error ── */}
      {serverError && (
        <div
          role="alert"
          className="rounded-[var(--border-radius)] border border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/10 px-4 py-3 text-sm text-[var(--color-destructive)]"
        >
          {serverError}
        </div>
      )}

      {/* ── Basic Info ── */}
      <Card>
        <CardHeader divider>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Event Name"
            required
            placeholder="FallCon 2025"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-foreground)]">
                URL Slug <span className="text-[var(--color-primary)]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setSlugLocked((v) => !v)}
                className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors"
              >
                {slugLocked ? 'Unlock' : 'Lock'}
              </button>
            </div>
            <Input
              placeholder="fallcon-2025"
              error={errors.slug?.message}
              disabled={slugLocked}
              hint="Auto-generated from name. Used in event URLs."
              {...register('slug')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--color-foreground)]">
                Status <span className="text-[var(--color-primary)]">*</span>
              </label>
              <select
                className="w-full h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                {...register('status')}
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.status && (
                <p className="text-xs text-[var(--color-destructive)]">{errors.status.message}</p>
              )}
            </div>
            <Input
              label="Banner Image URL"
              placeholder="https://..."
              error={errors.banner_url?.message}
              {...register('banner_url')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">Description</label>
            <textarea
              rows={3}
              placeholder="A short description shown on the event listing…"
              className="w-full px-3 py-2 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-muted-foreground)] resize-y"
              {...register('description')}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-foreground)]">Details</label>
            <textarea
              rows={5}
              placeholder="Full event details, agenda, instructions, etc.…"
              className="w-full px-3 py-2 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] placeholder:text-[var(--color-muted-foreground)] resize-y"
              {...register('details')}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Location ── */}
      <Card>
        <CardHeader divider>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Venue Name"
              placeholder="The Grand Ballroom"
              {...register('location_name')}
            />
            <Input
              label="Address"
              placeholder="123 Main St, City, State"
              {...register('location_address')}
            />
          </div>
          <Input
            label="Google Maps URL"
            placeholder="https://maps.google.com/..."
            error={errors.google_maps_url?.message}
            {...register('google_maps_url')}
          />
        </CardContent>
      </Card>

      {/* ── Dates ── */}
      <Card>
        <CardHeader divider>
          <CardTitle>Dates &amp; Times</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Start Date &amp; Time"
              type="datetime-local"
              required
              error={errors.start_date?.message}
              {...register('start_date')}
            />
            <Input
              label="End Date &amp; Time"
              type="datetime-local"
              {...register('end_date')}
            />
            <Input
              label="Ticket Edit Cutoff"
              type="datetime-local"
              hint="After this time, ticket owners can no longer edit assignments."
              {...register('cutoff_at')}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Event Links ── */}
      <Card>
        <CardHeader divider>
          <div className="flex items-center justify-between">
            <CardTitle>Event Links</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({ type: 'website', label: '', url: '', sort_order: fields.length })
              }
            >
              <Plus size={14} aria-hidden="true" />
              Add Link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-[var(--color-muted-foreground)] text-center py-4">
              No links yet. Add Zoom, Maps, website, or other links for attendees.
            </p>
          )}
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-start gap-3 p-3 rounded-[var(--border-radius)] bg-[var(--color-muted)] border border-[var(--color-border)]"
            >
              <GripVertical
                size={16}
                className="mt-2.5 text-[var(--color-muted-foreground)] shrink-0 cursor-grab"
                aria-hidden="true"
              />
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1 block">
                    Type
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-[var(--border-radius)] bg-[var(--color-card)] text-[var(--color-foreground)] border border-[var(--color-border)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    {...register(`links.${index}.type`)}
                  >
                    {linkTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Label"
                  placeholder="Join Zoom"
                  error={errors.links?.[index]?.label?.message}
                  {...register(`links.${index}.label`)}
                />
                <Input
                  label="URL"
                  placeholder="https://..."
                  error={errors.links?.[index]?.url?.message}
                  {...register(`links.${index}.url`)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-5 text-[var(--color-destructive)] hover:text-[var(--color-destructive)] shrink-0"
                onClick={() => remove(index)}
                aria-label="Remove link"
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Preview ── */}
      <Card>
        <CardHeader divider>
          <div className="flex items-center justify-between">
            <CardTitle>User Preview</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? (
                <><EyeOff size={14} aria-hidden="true" /> Hide</>
              ) : (
                <><Eye size={14} aria-hidden="true" /> Preview</>
              )}
            </Button>
          </div>
        </CardHeader>
        {showPreview && (
          <CardContent>
            <div className="rounded-[var(--border-radius)] border border-[var(--color-border)] overflow-hidden">
              {watchedValues.banner_url && (
                <div
                  className="h-40 bg-cover bg-center bg-[var(--color-muted)]"
                  style={{ backgroundImage: `url(${watchedValues.banner_url})` }}
                  aria-hidden="true"
                />
              )}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-heading text-xl font-bold text-[var(--color-foreground)]">
                    {watchedValues.name || 'Event Name'}
                  </h2>
                  <Badge variant={watchedValues.status === 'published' ? 'success' : 'warning'} dot>
                    {watchedValues.status}
                  </Badge>
                </div>
                {watchedValues.description && (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {watchedValues.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-[var(--color-muted-foreground)]">
                  {watchedValues.start_date && (
                    <span>📅 {watchedValues.start_date.replace('T', ' ')}</span>
                  )}
                  {watchedValues.location_name && (
                    <span>📍 {watchedValues.location_name}</span>
                  )}
                </div>
                {watchedValues.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {watchedValues.links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-primary)] hover:underline"
                      >
                        <ExternalLink size={11} aria-hidden="true" />
                        {link.label || link.type}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/admin/events')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!isDirty && mode === 'edit'}
          >
            {mode === 'create' ? 'Create Event' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  )
}
