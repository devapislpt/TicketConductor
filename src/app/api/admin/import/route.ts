import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/utils/audit'
import type { ImportResult } from '@/lib/types'
import Papa from 'papaparse'

// ─── POST /api/admin/import ───────────────────────────────────────────────────
// Accepts multipart/form-data with a CSV file field named "file".
// CSV columns: email, full_name, team_name, event_name, pack_name, ticket_count
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupa = createAdminClient()

    // Auth: admin only
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('app_users')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    // Parse multipart form
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ data: null, error: 'No CSV file provided' }, { status: 400 })
    }

    const csvText = await (file as Blob).text()

    // Parse CSV
    const { data: rows, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (parseErrors.length > 0 && rows.length === 0) {
      return NextResponse.json(
        { data: null, error: `CSV parse error: ${parseErrors[0]?.message}` },
        { status: 400 }
      )
    }

    const result: ImportResult = {
      success: 0,
      errors: [],
      created_users: 0,
      created_packs: 0,
    }

    // Cache team and event lookups to avoid repeat queries
    const teamCache = new Map<string, string>()  // name → id
    const eventCache = new Map<string, string>()  // name → id

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2  // 1-indexed, +1 for header
      const row = rows[i]

      const email = row.email?.trim()
      const fullName = row.full_name?.trim() || null
      const teamName = row.team_name?.trim() || null
      const eventName = row.event_name?.trim() || null
      const packName = row.pack_name?.trim() || null
      const ticketCount = parseInt(row.ticket_count ?? '0', 10)

      if (!email) {
        result.errors.push({ row: rowNum, message: 'Missing email' })
        continue
      }

      try {
        // ── 1. Upsert team ──────────────────────────────────────────────────
        let teamId: string | null = null
        if (teamName) {
          if (teamCache.has(teamName)) {
            teamId = teamCache.get(teamName)!
          } else {
            // Try to find existing
            const { data: existingTeam } = await adminSupa
              .from('teams')
              .select('id')
              .ilike('name', teamName)
              .single()

            if (existingTeam) {
              teamId = existingTeam.id
            } else {
              const { data: newTeam, error: teamErr } = await adminSupa
                .from('teams')
                .insert({ name: teamName })
                .select('id')
                .single()

              if (teamErr) throw new Error(`Team create failed: ${teamErr.message}`)
              teamId = newTeam.id
            }
            teamCache.set(teamName, teamId)
          }
        }

        // ── 2. Create or get Supabase Auth user ─────────────────────────────
        let authUserId: string | null = null

        // Check if auth user exists
        const { data: { users: existingAuthUsers } } = await adminSupa.auth.admin.listUsers()
        const existingAuthUser = existingAuthUsers.find((u) => u.email === email)

        if (existingAuthUser) {
          authUserId = existingAuthUser.id
        } else {
          const { data: newAuthData, error: authErr } = await adminSupa.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          })
          if (authErr) throw new Error(`Auth user create failed: ${authErr.message}`)
          authUserId = newAuthData.user.id
          result.created_users++
        }

        if (!authUserId) throw new Error('Could not determine user ID')

        // ── 3. Upsert app_users profile ────────────────────────────────────
        await adminSupa.from('app_users').upsert({
          id: authUserId,
          email,
          full_name: fullName,
          team_id: teamId,
          role: 'ticket_owner',
          is_active: true,
        }, { onConflict: 'id' })

        // ── 4. Resolve event ───────────────────────────────────────────────
        let eventId: string | null = null
        if (eventName) {
          if (eventCache.has(eventName)) {
            eventId = eventCache.get(eventName)!
          } else {
            const { data: ev } = await adminSupa
              .from('events')
              .select('id')
              .ilike('name', eventName)
              .single()

            if (!ev) {
              result.errors.push({ row: rowNum, message: `Event not found: "${eventName}"` })
              result.success++
              continue
            }
            eventId = ev.id
            eventCache.set(eventName, eventId)
          }
        }

        // ── 5. Create ticket pack (if event + pack info provided) ───────────
        if (eventId && packName && ticketCount > 0) {
          const { data: pack, error: packErr } = await adminSupa
            .from('ticket_packs')
            .insert({
              event_id: eventId,
              owner_id: authUserId,
              pack_name: packName,
              total_tickets: ticketCount,
            })
            .select('id')
            .single()

          if (packErr) {
            result.errors.push({ row: rowNum, message: `Pack create failed: ${packErr.message}` })
          } else {
            result.created_packs++

            await logAudit({
              actorId: user.id,
              actorEmail: profile.email,
              action: 'pack.create',
              entityType: 'ticket_pack',
              entityId: pack.id,
              newValue: { source: 'csv_import', pack_name: packName, owner_email: email },
            })
          }
        }

        result.success++
      } catch (rowError) {
        result.errors.push({
          row: rowNum,
          message: rowError instanceof Error ? rowError.message : 'Unknown error',
        })
      }
    }

    await logAudit({
      actorId: user.id,
      actorEmail: profile.email,
      action: 'user.create',
      entityType: 'csv_import',
      entityId: null,
      newValue: {
        total_rows: rows.length,
        success: result.success,
        errors: result.errors.length,
        created_users: result.created_users,
        created_packs: result.created_packs,
      },
    })

    return NextResponse.json({ data: result, error: null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ data: null, error: msg }, { status: 500 })
  }
}
