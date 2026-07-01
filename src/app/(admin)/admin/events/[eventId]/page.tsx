import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { EventForm } from '../_components/EventForm'
import type { AppEvent, EventLink } from '@/lib/types'

export const metadata = { title: 'Edit Event — Admin' }

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('events')
    .select('*, links:event_links(*)')
    .eq('id', eventId)
    .single()

  if (!data) notFound()

  const event = data as AppEvent & { links: EventLink[] }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
          Edit Event
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Editing: <span className="text-[var(--color-primary)]">{event.name}</span>
        </p>
      </div>
      <EventForm mode="edit" event={event} />
    </div>
  )
}
