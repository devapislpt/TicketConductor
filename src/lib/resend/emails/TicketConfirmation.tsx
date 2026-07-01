import * as React from 'react'
import { formatDate } from '@/lib/utils/format'

// ─── Props ────────────────────────────────────────────────────────────────────
interface TicketConfirmationProps {
  recipientName: string
  eventName: string
  eventDate: string
  locationName?: string
  locationAddress?: string
  qrCode?: string
  ticketNumber?: number
}

// ─── Inline style helpers ─────────────────────────────────────────────────────
const styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: '#0D0D0D',
    fontFamily: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    WebkitTextSizeAdjust: '100%' as const,
    MozTextSizeAdjust: '100%' as const,
  },
  outerTable: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderCollapse: 'collapse' as const,
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#0D0D0D',
  },
  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: '#0A0A0A',
    borderBottom: '1px solid #1E1E1E',
    padding: '32px 40px 28px',
    textAlign: 'center' as const,
  },
  logoText: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '22px',
    fontWeight: '600',
    color: '#C9A84C',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    margin: 0,
  },
  logoSub: {
    fontSize: '10px',
    color: '#5A5A5A',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    marginTop: '4px',
  },
  // ── Gold divider ─────────────────────────────────────────────────────────
  divider: {
    width: '48px',
    height: '1px',
    backgroundColor: '#C9A84C',
    margin: '20px auto 0',
    border: 'none',
  },
  // ── Hero section ─────────────────────────────────────────────────────────
  hero: {
    padding: '48px 40px 36px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #1E1E1E',
  },
  heroEyebrow: {
    fontSize: '11px',
    color: '#C9A84C',
    letterSpacing: '0.25em',
    textTransform: 'uppercase' as const,
    marginBottom: '12px',
  },
  heroHeading: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '32px',
    fontWeight: '400',
    color: '#F0EDE6',
    lineHeight: '1.25',
    letterSpacing: '0.02em',
    margin: '0 0 8px',
  },
  heroSub: {
    fontSize: '15px',
    color: '#8A8A8A',
    marginTop: '8px',
    lineHeight: '1.5',
  },
  checkIcon: {
    display: 'inline-block',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    border: '1px solid rgba(22, 163, 74, 0.3)',
    lineHeight: '56px',
    fontSize: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  // ── Details card ─────────────────────────────────────────────────────────
  detailsSection: {
    padding: '32px 40px',
    borderBottom: '1px solid #1E1E1E',
  },
  detailsCard: {
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    padding: '24px',
  },
  detailsHeading: {
    fontSize: '11px',
    color: '#C9A84C',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
    marginTop: 0,
  },
  detailRow: {
    borderBottom: '1px solid #1E1E1E',
    paddingBottom: '12px',
    marginBottom: '12px',
  },
  detailLabel: {
    fontSize: '11px',
    color: '#5A5A5A',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    display: 'block',
    marginBottom: '3px',
  },
  detailValue: {
    fontSize: '15px',
    color: '#F0EDE6',
    fontWeight: '500',
  },
  detailValueMuted: {
    fontSize: '13px',
    color: '#8A8A8A',
    marginTop: '2px',
  },
  // ── QR / ticket number ───────────────────────────────────────────────────
  qrSection: {
    padding: '32px 40px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #1E1E1E',
  },
  qrBox: {
    display: 'inline-block',
    backgroundColor: '#141414',
    border: '1px solid #2A2A2A',
    borderRadius: '8px',
    padding: '20px 32px',
    marginTop: '8px',
  },
  qrEyebrow: {
    fontSize: '11px',
    color: '#5A5A5A',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
    marginBottom: '8px',
  },
  qrValue: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '13px',
    color: '#C9A84C',
    letterSpacing: '0.12em',
    wordBreak: 'break-all' as const,
  },
  ticketNumLabel: {
    fontSize: '11px',
    color: '#5A5A5A',
    letterSpacing: '0.2em',
    textTransform: 'uppercase' as const,
  },
  ticketNum: {
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontSize: '36px',
    color: '#C9A84C',
    lineHeight: '1',
    marginTop: '4px',
  },
  // ── Info box ─────────────────────────────────────────────────────────────
  infoSection: {
    padding: '28px 40px',
    borderBottom: '1px solid #1E1E1E',
  },
  infoBox: {
    backgroundColor: 'rgba(201, 168, 76, 0.06)',
    border: '1px solid rgba(201, 168, 76, 0.2)',
    borderRadius: '8px',
    padding: '16px 20px',
  },
  infoText: {
    fontSize: '13px',
    color: '#8A8A8A',
    lineHeight: '1.6',
    margin: 0,
  },
  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    padding: '28px 40px',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '12px',
    color: '#3A3A3A',
    lineHeight: '1.6',
    margin: '0 0 6px',
  },
  footerLink: {
    color: '#5A5A5A',
    textDecoration: 'underline',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TicketConfirmation({
  recipientName,
  eventName,
  eventDate,
  locationName,
  locationAddress,
  qrCode,
  ticketNumber,
}: TicketConfirmationProps) {
  const formattedDate = formatDate(eventDate, 'EEEE, MMMM d, yyyy')
  const firstName = recipientName.split(' ')[0]

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Your ticket to {eventName} is confirmed</title>
      </head>
      <body style={styles.body}>
        <table style={styles.outerTable} cellPadding={0} cellSpacing={0} role="presentation">
          <tbody>
            <tr>
              <td>
                <div style={styles.container}>

                  {/* ── Header / Logo ─────────────────────────────────── */}
                  <div style={styles.header}>
                    <p style={styles.logoText}>FallCon</p>
                    <p style={styles.logoSub}>Ticket Conductor</p>
                    <hr style={styles.divider} />
                  </div>

                  {/* ── Hero ─────────────────────────────────────────── */}
                  <div style={styles.hero}>
                    <div style={styles.checkIcon} aria-hidden="true">✓</div>
                    <p style={styles.heroEyebrow}>Ticket Confirmed</p>
                    <h1 style={styles.heroHeading}>
                      You&apos;re going to<br />{eventName}
                    </h1>
                    <p style={styles.heroSub}>
                      Hello {firstName}, your ticket has been confirmed.<br />
                      We look forward to seeing you there.
                    </p>
                  </div>

                  {/* ── Event Details ─────────────────────────────────── */}
                  <div style={styles.detailsSection}>
                    <div style={styles.detailsCard}>
                      <p style={styles.detailsHeading}>Event Details</p>

                      {/* Recipient */}
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Attendee</span>
                        <span style={styles.detailValue}>{recipientName}</span>
                      </div>

                      {/* Event */}
                      <div style={styles.detailRow}>
                        <span style={styles.detailLabel}>Event</span>
                        <span style={styles.detailValue}>{eventName}</span>
                      </div>

                      {/* Date */}
                      <div style={{ ...styles.detailRow }}>
                        <span style={styles.detailLabel}>Date</span>
                        <span style={styles.detailValue}>{formattedDate}</span>
                      </div>

                      {/* Location */}
                      {(locationName || locationAddress) && (
                        <div style={{ paddingBottom: 0, marginBottom: 0 }}>
                          <span style={styles.detailLabel}>Location</span>
                          {locationName && (
                            <span style={styles.detailValue}>{locationName}</span>
                          )}
                          {locationAddress && (
                            <p style={styles.detailValueMuted}>{locationAddress}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Ticket Number / QR ────────────────────────────── */}
                  <div style={styles.qrSection}>
                    {ticketNumber !== undefined && (
                      <div style={{ marginBottom: qrCode ? '24px' : '0' }}>
                        <p style={styles.ticketNumLabel}>Ticket Number</p>
                        <p style={styles.ticketNum}>
                          #{String(ticketNumber).padStart(2, '0')}
                        </p>
                      </div>
                    )}

                    {qrCode && (
                      <div>
                        <p style={{ ...styles.qrEyebrow, marginBottom: '12px' }}>
                          Your QR Code
                        </p>
                        <div style={styles.qrBox}>
                          <p style={styles.qrEyebrow}>Scan at entry</p>
                          <p style={styles.qrValue}>{qrCode}</p>
                        </div>
                        <p style={{
                          fontSize: '12px',
                          color: '#5A5A5A',
                          marginTop: '12px',
                        }}>
                          Present this code at the event entrance.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── Info note ────────────────────────────────────── */}
                  <div style={styles.infoSection}>
                    <div style={styles.infoBox}>
                      <p style={styles.infoText}>
                        <strong style={{ color: '#C9A84C' }}>Need to make changes?</strong>
                        {' '}The person who manages your ticket pack can update assignment
                        details before the editing deadline. Please contact them directly
                        if you need any modifications.
                      </p>
                    </div>
                  </div>

                  {/* ── Footer ───────────────────────────────────────── */}
                  <div style={styles.footer}>
                    <p style={styles.footerText}>
                      &copy; {new Date().getFullYear()} FallCon Ticket Conductor.
                      All rights reserved.
                    </p>
                    <p style={styles.footerText}>
                      This email was sent to you because a ticket was assigned to your
                      email address.
                    </p>
                    <p style={{ ...styles.footerText, marginTop: '8px' }}>
                      {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                      <a href="#" style={styles.footerLink}>
                        Unsubscribe
                      </a>
                      {' · '}
                      <a href="#" style={styles.footerLink}>
                        Privacy Policy
                      </a>
                    </p>
                  </div>

                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}
