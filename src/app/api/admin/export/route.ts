import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ─── GET /api/admin/export ────────────────────────────────────────────────────
// Query params:
//   event_id  (required unless type=audit)
//   format    csv | json  (default: csv)
//   by        pack | checkin  (default: full roster)
//   type      audit  (special: exports audit log)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'event_assistant'
    if (!isAdmin) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(req.url)
    const eventId = url.searchParams.get('event_id')
    const format = url.searchParams.get('format') ?? 'csv'
    const by = url.searchParams.get('by')          // 'pack' | 'checkin'
    const type = url.searchParams.get('type')      // 'audit'

    // ── Audit log export ────────────────────────────────────────────────────
    if (type === 'audit') {
      const { data: logs } = await adminSupa
        .from('audit_logs')
        .select('created_at, actor_email, action, entity_type, entity_id')
        .order('created_at', { ascending: false })
        .limit(10000)

      const csvRows = [
        ['Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID'],
        ...(logs ?? []).map((log: any) => [
          log.created_at,
          log.actor_email ?? '',
          log.action,
          log.entity_type,
          log.entity_id ?? '',
        ]),
      ]

      return csvResponse(csvRows, 'audit-log')
    }

    // ── Ticket roster exports — event_id required ────────────────────────────
    if (!eventId) {
      return NextResponse.json({ data: null, error: 'event_id is required' }, { status: 400 })
    }

    // Fetch event
    const { data: event } = await adminSupa
      .from('events')
      .select('id, name, slug')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ data: null, error: 'Event not found' }, { status: 404 })
    }

    // Fetch packs with full ticket data
    const { data: packs } = await adminSupa
      .from('ticket_packs')
      .select(`
        id,
        pack_name,
        total_tickets,
        owner:app_users(full_name, email, team:teams(name)),
        tickets(
          id,
          sort_order,
          status,
          recipient_name,
          recipient_email,
          checked_in_at
        )
      `)
      .eq('event_id', eventId)
      .order('created_at')

    const safePacks = (packs ?? []) as Array<{
      id: string
      pack_name: string
      total_tickets: number
      owner: { full_name: string | null; email: string; team: { name: string } | null } | null
      tickets: Array<{
        id: string
        sort_order: number
        status: string
        recipient_name: string | null
        recipient_email: string | null
        checked_in_at: string | null
      }>
    }>

    const filename = `${event.slug ?? 'event'}`

    // ── By Pack ──────────────────────────────────────────────────────────────
    if (by === 'pack') {
      const header = ['Pack Owner', 'Owner Email', 'Team', 'Pack Name', 'Total Tickets', 'Assigned', 'Unassigned']
      const rows = safePacks.map((p) => {
        const assigned = p.tickets.filter((t) => t.status !== 'unassigned').length
        return [
          p.owner?.full_name ?? '',
          p.owner?.email ?? '',
          p.owner?.team?.name ?? '',
          p.pack_name,
          p.total_tickets,
          assigned,
          p.total_tickets - assigned,
        ]
      })
      return csvResponse([header, ...rows], `${filename}-by-pack`)
    }

    // ── Check-in Report ───────────────────────────────────────────────────────
    if (by === 'checkin') {
      const header = ['Recipient Name', 'Recipient Email', 'Pack', 'Pack Owner', 'Owner Email', 'Team', 'Checked In At']
      const rows: (string | number)[][] = []

      for (const pack of safePacks) {
        const checkedIn = pack.tickets.filter((t) => t.status === 'checked_in')
        for (const ticket of checkedIn) {
          rows.push([
            ticket.recipient_name ?? '',
            ticket.recipient_email ?? '',
            pack.pack_name,
            pack.owner?.full_name ?? '',
            pack.owner?.email ?? '',
            pack.owner?.team?.name ?? '',
            ticket.checked_in_at ?? '',
          ])
        }
      }

      return csvResponse([header, ...rows], `${filename}-checkin-report`)
    }

    // ── Full Roster (default) ────────────────────────────────────────────────
    const header = [
      'Pack Owner',
      'Owner Email',
      'Team',
      'Pack Name',
      'Ticket #',
      'Recipient Name',
      'Recipient Email',
      'Status',
    ]

    const rows: (string | number)[][] = []
    for (const pack of safePacks) {
      const sortedTickets = [...pack.tickets].sort((a, b) => a.sort_order - b.sort_order)
      for (const ticket of sortedTickets) {
        rows.push([
          pack.owner?.full_name ?? '',
          pack.owner?.email ?? '',
          pack.owner?.team?.name ?? '',
          pack.pack_name,
          ticket.sort_order + 1,
          ticket.recipient_name ?? '',
          ticket.recipient_email ?? '',
          ticket.status,
        ])
      }
    }

    if (format === 'json') {
      return NextResponse.json({ data: rows, error: null })
    }

    return csvResponse([header, ...rows], `${filename}-roster`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}

// ─── Helper: build CSV response ───────────────────────────────────────────────
function csvResponse(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          // Quote cells that contain commas, quotes, or newlines
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`
          }
          return s
        })
        .join(',')
    )
    .join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
