'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

// ─── Types ─────────────────────────────────────────────────────────────────
export type SortDirection = 'asc' | 'desc' | null

export interface ColumnDef<T> {
  key: string
  header: string
  /** Access value from row. Can return any renderable value. */
  accessor: (row: T) => React.ReactNode
  /** Allow sorting on this column */
  sortable?: boolean
  /** Optional className for the cell td */
  cellClassName?: string
  /** Optional className for the header th */
  headerClassName?: string
  /** Hide this column on mobile */
  hideOnMobile?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  /** Key field for React keys */
  rowKey: (row: T) => string
  /** Loading state — shows skeleton rows */
  loading?: boolean
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number
  /** Empty state message */
  emptyMessage?: string
  /** Empty state icon (Lucide component) */
  emptyIcon?: React.ElementType
  /** Page size for client-side pagination. 0 = no pagination */
  pageSize?: number
  /** Server-side pagination: total rows */
  totalRows?: number
  /** Server-side pagination: current page (0-indexed) */
  currentPage?: number
  /** Server-side pagination: callback */
  onPageChange?: (page: number) => void
  /** Server-side sort callback */
  onSort?: (key: string, direction: SortDirection) => void
  /** Optional row click handler */
  onRowClick?: (row: T) => void
  /** Optional class for the table wrapper */
  className?: string
}

// ─── Sort Icon ─────────────────────────────────────────────────────────────
function SortIcon({ direction }: { direction: SortDirection }) {
  if (direction === 'asc')  return <ChevronUp  size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
  if (direction === 'desc') return <ChevronDown size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
  return <ChevronsUpDown size={14} className="opacity-40" aria-hidden="true" />
}

// ─── Skeleton Row ──────────────────────────────────────────────────────────
function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="border-b border-[var(--color-border)]">
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 rounded bg-[var(--color-muted)] animate-pulse"
            style={{ width: `${60 + Math.random() * 30}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

// ─── Mobile Card ───────────────────────────────────────────────────────────
function MobileCard<T>({
  row,
  columns,
  onClick,
}: {
  row: T
  columns: ColumnDef<T>[]
  onClick?: (row: T) => void
}) {
  const visibleColumns = columns.filter((c) => !c.hideOnMobile)
  const [primary, ...rest] = visibleColumns

  return (
    <motion.div
      className={cn(
        'bg-[var(--color-card)] border border-[var(--color-border)]',
        'rounded-[var(--border-radius)] p-4 space-y-2',
        onClick && 'cursor-pointer hover:border-[var(--color-primary)]/50',
        'transition-colors duration-150'
      )}
      whileHover={onClick ? { y: -1 } : undefined}
      onClick={onClick ? () => onClick(row) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick(row) : undefined}
    >
      {/* Primary field — larger */}
      {primary && (
        <div className="font-medium text-[var(--color-foreground)]">
          {primary.accessor(row)}
        </div>
      )}

      {/* Rest as label: value pairs */}
      {rest.map((col) => (
        <div key={col.key} className="flex items-center justify-between gap-4">
          <span className="text-xs text-[var(--color-muted-foreground)] shrink-0">
            {col.header}
          </span>
          <span className="text-sm text-[var(--color-foreground)] text-right">
            {col.accessor(row)}
          </span>
        </div>
      ))}
    </motion.div>
  )
}

// ─── Pagination Controls ───────────────────────────────────────────────────
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  totalRows,
  pageSize,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  totalRows: number
  pageSize: number
}) {
  const startRow = currentPage * pageSize + 1
  const endRow   = Math.min((currentPage + 1) * pageSize, totalRows)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
      <p className="text-xs text-[var(--color-muted-foreground)]">
        {totalRows === 0
          ? 'No results'
          : `${startRow}–${endRow} of ${totalRows}`
        }
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Previous page"
          silent
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <span className="text-xs text-[var(--color-muted-foreground)] min-w-[60px] text-center">
          {currentPage + 1} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          aria-label="Next page"
          silent
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  skeletonRows = 5,
  emptyMessage = 'No results found.',
  emptyIcon: EmptyIcon = Inbox,
  pageSize = 0,
  totalRows,
  currentPage: externalPage,
  onPageChange: externalPageChange,
  onSort,
  onRowClick,
  className,
}: DataTableProps<T>) {
  // ── Sort state ──────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<SortDirection>(null)

  // ── Client-side pagination state ────────────────────────────────────────
  const [internalPage, setInternalPage] = React.useState(0)

  const isServerPaginated = externalPage !== undefined && externalPageChange !== undefined
  const currentPage = isServerPaginated ? externalPage : internalPage
  const onPageChange = isServerPaginated ? externalPageChange : setInternalPage

  // ── Client-side sort ────────────────────────────────────────────────────
  const sortedData = React.useMemo(() => {
    if (!sortKey || onSort) return data // server handles sort
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return data

    return [...data].sort((a, b) => {
      const va = String(col.accessor(a) ?? '')
      const vb = String(col.accessor(b) ?? '')
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortKey, sortDir, columns, onSort])

  // ── Client-side pagination ──────────────────────────────────────────────
  const pagedData = React.useMemo(() => {
    if (pageSize <= 0 || isServerPaginated) return sortedData
    const start = currentPage * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [sortedData, currentPage, pageSize, isServerPaginated])

  const effectiveTotalRows = totalRows ?? data.length
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(effectiveTotalRows / pageSize)) : 1

  const displayRows = pageSize > 0 ? pagedData : sortedData

  // ── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = (key: string) => {
    let nextDir: SortDirection
    if (sortKey !== key) {
      nextDir = 'asc'
    } else if (sortDir === 'asc') {
      nextDir = 'desc'
    } else {
      nextDir = null
    }

    setSortKey(nextDir ? key : null)
    setSortDir(nextDir)
    onSort?.(key, nextDir)
  }

  const isEmpty = !loading && displayRows.length === 0

  return (
    <div className={cn('w-full', className)}>
      {/* ── Desktop Table ── */}
      <div className="hidden md:block overflow-x-auto rounded-[var(--border-radius)] border border-[var(--color-border)]">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]',
                    'tracking-wide text-xs uppercase',
                    col.sortable && 'cursor-pointer select-none hover:text-[var(--color-foreground)]',
                    'transition-colors duration-150',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  aria-sort={
                    col.sortable
                      ? sortKey === col.key
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  <span className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Loading skeletons */}
            {loading && Array.from({ length: skeletonRows }).map((_, i) => (
              <SkeletonRow key={i} columnCount={columns.length} />
            ))}

            {/* Empty state */}
            {isEmpty && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-[var(--color-muted-foreground)]">
                    <EmptyIcon size={36} strokeWidth={1} aria-hidden="true" />
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            <AnimatePresence mode="popLayout">
              {!loading && displayRows.map((row) => (
                <motion.tr
                  key={rowKey(row)}
                  className={cn(
                    'border-b border-[var(--color-border)] last:border-0',
                    'group relative',
                    'transition-colors duration-150',
                    'hover:bg-[var(--color-muted)]',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  layout
                >
                  {/* Gold left border on hover */}
                  <td
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    aria-hidden="true"
                  />

                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-[var(--color-foreground)] align-middle',
                        col.cellClassName
                      )}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {/* Pagination */}
        {pageSize > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            totalRows={effectiveTotalRows}
            pageSize={pageSize}
          />
        )}
      </div>

      {/* ── Mobile Card Layout ── */}
      <div className="md:hidden space-y-3">
        {loading && Array.from({ length: skeletonRows }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[var(--border-radius)] p-4 space-y-2"
          >
            {columns.slice(0, 3).map((_, ci) => (
              <div
                key={ci}
                className="h-4 rounded bg-[var(--color-muted)] animate-pulse"
                style={{ width: `${50 + ci * 15}%` }}
              />
            ))}
          </div>
        ))}

        {isEmpty && (
          <div className="flex flex-col items-center gap-3 py-16 text-[var(--color-muted-foreground)]">
            <EmptyIcon size={36} strokeWidth={1} aria-hidden="true" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!loading && displayRows.map((row) => (
            <motion.div
              key={rowKey(row)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              layout
            >
              <MobileCard row={row} columns={columns} onClick={onRowClick} />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Mobile pagination */}
        {pageSize > 0 && !isEmpty && !loading && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {currentPage + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 0}
                silent
              >
                <ChevronLeft size={14} aria-hidden="true" /> Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                silent
              >
                Next <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
