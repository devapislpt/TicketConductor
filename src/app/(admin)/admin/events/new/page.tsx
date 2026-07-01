import { EventForm } from '../_components/EventForm'

export const metadata = { title: 'New Event — Admin' }

export default function NewEventPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-[var(--letter-spacing-heading)] text-[var(--color-foreground)]">
          New Event
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Fill in the details below to create a new FallCon event.
        </p>
      </div>
      <EventForm mode="create" />
    </div>
  )
}
