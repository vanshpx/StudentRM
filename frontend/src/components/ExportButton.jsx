// Map UI filter values to backend-compatible status_filter values
const STATUS_EXPORT_MAP = {
  All:          'All',
  Active:       'Active',
  NotQualified: 'NotQualified',
  Debarred:     'Debarred',
}

const STATUS_LABEL_MAP = {
  All:          'All',
  Active:       'Qualified',
  NotQualified: 'Not Qualified',
  Debarred:     'Debarred',
}

export default function ExportButton({ minTotal, filters = {} }) {
  const statusFilter  = STATUS_EXPORT_MAP[filters.status]  ?? 'Active'
  const flaggedFilter = filters.flagged ?? 'No'

  const params = new URLSearchParams({
    min_total:      minTotal,
    status_filter:  statusFilter,
    flagged_filter: flaggedFilter,
  })
  const href = `/api/export?${params.toString()}`

  const statusLabel  = STATUS_LABEL_MAP[filters.status] ?? 'Qualified'
  const flaggedLabel = flaggedFilter !== 'All' && flaggedFilter !== 'No'
    ? ` · Flagged: ${flaggedFilter}` : ''

  return (
    <a
      id="export-button"
      href={href}
      download="shortlist.csv"
      className="btn-primary no-underline"
      aria-label={`Export shortlist as CSV — ${statusLabel}${flaggedLabel}, min total ${minTotal}`}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Export Shortlist
    </a>
  )
}
